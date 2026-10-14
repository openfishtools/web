export async function onRequest(context) {
    const url = new URL(context.request.url);

    const origin = context.request.headers.get('origin');
    const referer = context.request.headers.get('referer');
    const secFetchDest = context.request.headers.get('sec-fetch-dest');

    const isAllowedHost = (hostStr) => {
        if (!hostStr) return false;
        const h = hostStr.toLowerCase().split(':')[0];
        if (h === 'cutefish.my.id' || h === 'www.cutefish.my.id' || h === 'localhost' || h === '127.0.0.1') return true;
        if (h.endsWith('.pages.dev') || h.endsWith('.vercel.app')) return true;
        return false;
    };

    const isOriginAllowed = (originStr) => {
        if (!originStr) return true;
        try {
            return isAllowedHost(new URL(originStr).hostname);
        } catch (_) {
            return false;
        }
    };

    // Anti-Leech: Reject cross-origin calls from foreign websites
    if (origin && !isOriginAllowed(origin)) {
        return new Response(JSON.stringify({
            error: 'Forbidden',
            message: 'Cross-origin API access from external websites is strictly forbidden. Please use https://cutefish.my.id'
        }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Anti-Hotlink: Reject if referer belongs to foreign website
    if (referer) {
        try {
            const refHost = new URL(referer).hostname;
            if (!isAllowedHost(refHost)) {
                return new Response(JSON.stringify({
                    error: 'Forbidden',
                    message: 'Hotlinking or embedding from external sites is strictly blocked. Please use https://cutefish.my.id'
                }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        } catch (e) {}
    }

    if (secFetchDest === 'document' && context.request.method === 'GET') {
        return Response.redirect('https://cutefish.my.id', 302);
    }

    const corsOrigin = (origin && isOriginAllowed(origin)) ? origin : 'https://cutefish.my.id';

    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': corsOrigin,
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-requested-with'
            }
        });
    }

    // --- DIRECT CLOUDFLARE EDGE PROXY ---
    // Completely offload video & asset downloads from Vercel to save bandwidth and compute
    if (url.pathname === '/api/proxy') {
        const rawTarget = url.searchParams.get('url');
        if (!rawTarget) {
            return new Response(JSON.stringify({ error: 'Missing url query parameter' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
            });
        }
        let resolvedUrl = rawTarget;
        try {
            const u = new URL(rawTarget);
            if (u.hostname === 'github.com') {
                const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
                if (m) resolvedUrl = `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
            } else if (u.hostname === 'pastebin.com' && !u.pathname.startsWith('/raw/')) {
                const m = u.pathname.match(/^\/([^/]+)$/);
                if (m) resolvedUrl = `https://pastebin.com/raw${u.pathname}`;
            }
        } catch (_) {}

        try {
            const proxyHeaders = new Headers();
            proxyHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            proxyHeaders.set('Accept', '*/*');
            const range = context.request.headers.get('range');
            if (range) proxyHeaders.set('range', range);

            const upstream = await fetch(resolvedUrl, {
                headers: proxyHeaders,
                redirect: 'follow'
            });

            const respHeaders = new Headers(upstream.headers);
            respHeaders.set('Access-Control-Allow-Origin', corsOrigin);
            respHeaders.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
            respHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-requested-with, Range');
            respHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type');
            respHeaders.set('CF-Edge-Proxy', 'true');

            return new Response(upstream.body, {
                status: upstream.status,
                statusText: upstream.statusText,
                headers: respHeaders
            });
        } catch (err) {
            return new Response(JSON.stringify({ error: 'Proxy request failed', details: err.message }), {
                status: 502,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
            });
        }
    }

    // --- CLOUDFLARE EDGE CACHE SHIELD ---
    // Protect Vercel from usage quota limits by caching repetitive GET requests at the edge
    function getCacheTtl(pathname, searchParams) {
        if (context.request.method !== 'GET') return 0;
        if (searchParams.get('nocache') === '1') return 0;
        if (pathname.startsWith('/api/admin')) return 0;

        if (pathname === '/api/version') return 86400; // 24 hours
        if (pathname === '/api/tiktok-posts') return 21600; // 6 hours
        if (pathname === '/api/tiktok-resolve' || pathname === '/api/tiktok-fps') return 86400; // 24 hours
        if (pathname === '/api/tiktok-thumb') return 86400; // 24 hours
        if (pathname === '/api/tools') return 300; // 5 minutes
        if (['/api/presets', '/api/socials', '/api/contacts', '/api/resources'].includes(pathname)) return 86400; // 24 hours

        return 0;
    }

    const cacheTtl = getCacheTtl(url.pathname, url.searchParams);
    const cache = typeof caches !== 'undefined' ? caches.default : null;
    const cacheKey = new Request(url.toString(), { method: 'GET' });

    // Check Cloudflare Edge Cache first
    if (cache && cacheTtl > 0) {
        try {
            const cachedResponse = await cache.match(cacheKey);
            if (cachedResponse) {
                const cachedText = await cachedResponse.clone().text();
                if (cachedText.trim() === '[]') {
                    context.waitUntil(cache.delete(cacheKey));
                } else {
                    const newHeaders = new Headers(cachedResponse.headers);
                    newHeaders.set('CF-Cache-Status', 'HIT');
                    newHeaders.set('X-Edge-Cache', 'HIT');
                    newHeaders.set('Access-Control-Allow-Origin', corsOrigin);
                    newHeaders.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
                    newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-requested-with');
                    newHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type, CF-Cache-Status, X-Edge-Cache');
                    return new Response(cachedText, {
                        status: cachedResponse.status,
                        statusText: cachedResponse.statusText,
                        headers: newHeaders
                    });
                }
            }
        } catch (_) {}
    }

    const backendOrigin = context.env.BACKEND_API_URL || 'https://web-tau-lovat-70.vercel.app';
    const targetUrl = new URL(url.pathname + url.search, backendOrigin);

    const headers = new Headers(context.request.headers);
    headers.set('host', targetUrl.host);
    if (context.env.PROXY_SECRET) {
        headers.set('x-cf-secret', context.env.PROXY_SECRET);
    }

    const init = {
        method: context.request.method,
        headers: headers,
        redirect: 'follow'
    };

    if (context.request.method !== 'GET' && context.request.method !== 'HEAD' && context.request.method !== 'DELETE') {
        const contentLength = context.request.headers.get('content-length');
        const contentType = context.request.headers.get('content-type');
        if ((contentLength && contentLength !== '0') || contentType) {
            init.body = context.request.body;
        }
    }

    try {
        const response = await fetch(targetUrl.toString(), init);
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', corsOrigin);
        newHeaders.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
        newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-requested-with');
        newHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type, CF-Cache-Status, X-Edge-Cache');
        newHeaders.set('CF-Cache-Status', 'MISS');
        newHeaders.set('X-Edge-Cache', 'MISS');

        // If response is successful and eligible for edge caching, save to Cloudflare Cache (skip empty [] fallback responses)
        if (cache && cacheTtl > 0 && response.status === 200) {
            try {
                const cloned = response.clone();
                const bodyText = await cloned.text();
                const trimmed = bodyText.trim();
                if (trimmed && trimmed !== '[]') {
                    const cacheHeaders = new Headers(response.headers);
                    cacheHeaders.set('Cache-Control', `public, max-age=${cacheTtl}, s-maxage=${cacheTtl}`);
                    cacheHeaders.set('Access-Control-Allow-Origin', corsOrigin);
                    const responseToCache = new Response(bodyText, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: cacheHeaders
                    });
                    context.waitUntil(cache.put(cacheKey, responseToCache));
                }
            } catch (_) {}
        }

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Backend proxy failed', details: err.message }), {
            status: 502,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': corsOrigin
            }
        });
    }
}
