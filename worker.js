export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        const origin = request.headers.get('origin');
        const referer = request.headers.get('referer');
        const secFetchDest = request.headers.get('sec-fetch-dest');

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

        // 1. Anti-Leech: Reject requests originating from unauthorized external websites
        if (origin && !isOriginAllowed(origin)) {
            return new Response(JSON.stringify({
                error: 'Forbidden',
                message: 'Cross-origin API access from external websites is strictly forbidden. Please use https://cutefish.my.id'
            }), {
                status: 403,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        // 2. Anti-Hotlink: Reject if Referer belongs to an external website
        if (referer) {
            try {
                const refHost = new URL(referer).hostname;
                if (!isAllowedHost(refHost)) {
                    return new Response(JSON.stringify({
                        error: 'Forbidden',
                        message: 'Hotlinking or embedding from external sites is strictly blocked. Please use https://cutefish.my.id'
                    }), {
                        status: 403,
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                }
            } catch (e) {
                // Ignore malformed referer
            }
        }

        // Determine CORS origin - never allow wildcard *
        const corsOrigin = (origin && isOriginAllowed(origin)) ? origin : 'https://cutefish.my.id';

        // Handle CORS Preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': corsOrigin,
                    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-requested-with'
                }
            });
        }

        // Proxy RealESRGAN model requests directly to upscale host (saves Vercel limits completely)
        if (url.pathname.startsWith('/realesrgan')) {
            const chinoTarget = new URL(url.pathname + url.search, 'https://upscale.chino.icu');
            const chinoHeaders = new Headers(request.headers);
            chinoHeaders.set('host', chinoTarget.host);
            try {
                let chinoRes = await fetch(chinoTarget.toString(), {
                    method: request.method,
                    headers: chinoHeaders,
                    redirect: 'follow'
                });
                if (!chinoRes.ok && env.BACKEND_API_URL) {
                    const fallbackUrl = new URL(url.pathname + url.search, env.BACKEND_API_URL);
                    const fbHeaders = new Headers(request.headers);
                    fbHeaders.set('host', fallbackUrl.host);
                    if (env.PROXY_SECRET) fbHeaders.set('x-cf-secret', env.PROXY_SECRET);
                    chinoRes = await fetch(fallbackUrl.toString(), { method: request.method, headers: fbHeaders });
                }
                const newHeaders = new Headers(chinoRes.headers);
                newHeaders.set('Access-Control-Allow-Origin', corsOrigin);
                newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
                newHeaders.set('Cache-Control', 'public, max-age=604800, s-maxage=604800');
                return new Response(chinoRes.body, {
                    status: chinoRes.status,
                    statusText: chinoRes.statusText,
                    headers: newHeaders
                });
            } catch (err) {
                return new Response(JSON.stringify({ error: 'Realesrgan proxy failed', details: err.message }), {
                    status: 502,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
                });
            }
        }

        // Direct Cloudflare Edge Proxy - Completely offload video/asset downloads from Vercel
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
                const range = request.headers.get('range');
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

        // Proxy API requests to Vercel Backend with Security Shield & Edge Caching
        if (url.pathname.startsWith('/api')) {
            // 3. Browser direct address bar visit protection: redirect to home
            if (secFetchDest === 'document' && request.method === 'GET') {
                return Response.redirect('https://cutefish.my.id', 302);
            }

            const backendOrigin = env.BACKEND_API_URL || 'https://web-tau-lovat-70.vercel.app';
            const targetUrl = new URL(url.pathname + url.search, backendOrigin);

            // Cloudflare Edge Cache for public read-only GET endpoints (Saves Vercel Limits)
            function getCacheTtl(pathname, searchParams) {
                if (request.method !== 'GET') return 0;
                if (searchParams.get('nocache') === '1') return 0;
                if (pathname.startsWith('/api/admin')) return 0;

                if (pathname === '/api/version') return 86400; // 24 hours
                if (pathname === '/api/tiktok-posts') return 21600; // 6 hours
                if (pathname === '/api/tiktok-resolve' || pathname === '/api/tiktok-fps') return 86400; // 24 hours
                if (pathname === '/api/tiktok-thumb') return 86400; // 24 hours
                if (['/api/presets', '/api/socials', '/api/contacts', '/api/resources'].includes(pathname)) return 86400; // 24 hours

                return 0;
            }

            const cacheTtl = getCacheTtl(url.pathname, url.searchParams);
            const cache = caches.default;
            const cacheKey = new Request(url.toString(), { method: 'GET' });

            if (cacheTtl > 0) {
                const cachedResponse = await cache.match(cacheKey);
                if (cachedResponse) {
                    const cachedText = await cachedResponse.clone().text();
                    if (cachedText.trim() === '[]') {
                        if (ctx && ctx.waitUntil) {
                            ctx.waitUntil(cache.delete(cacheKey));
                        }
                    } else {
                        const hitHeaders = new Headers(cachedResponse.headers);
                        hitHeaders.set('CF-Cache-Status', 'HIT');
                        hitHeaders.set('X-Edge-Cache', 'HIT');
                        hitHeaders.set('Access-Control-Allow-Origin', corsOrigin);
                        hitHeaders.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
                        hitHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-requested-with');
                        hitHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type, CF-Cache-Status, X-Edge-Cache');
                        return new Response(cachedText, {
                            status: cachedResponse.status,
                            statusText: cachedResponse.statusText,
                            headers: hitHeaders
                        });
                    }
                }
            }

            const headers = new Headers(request.headers);
            headers.set('host', targetUrl.host);

            // Injected secret handshake header - verifies that request comes from cutefish.my.id
            const proxySecret = env.PROXY_SECRET;
            if (proxySecret) {
                headers.set('x-cf-secret', proxySecret);
            }

            const init = {
                method: request.method,
                headers: headers,
                redirect: 'follow'
            };

            if (request.method !== 'GET' && request.method !== 'HEAD') {
                init.body = request.body;
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

                // Cache successful GET responses in Cloudflare's Edge CDN (skip empty [] fallback responses)
                if (cacheTtl > 0 && response.ok) {
                    const cloned = response.clone();
                    const bodyText = await cloned.text();
                    const trimmed = bodyText.trim();
                    if (trimmed && trimmed !== '[]') {
                        const cacheHeaders = new Headers(response.headers);
                        cacheHeaders.set('Cache-Control', `public, max-age=${cacheTtl}, s-maxage=${cacheTtl}`);
                        cacheHeaders.set('Access-Control-Allow-Origin', corsOrigin);
                        cacheHeaders.set('CF-Cache-Status', 'HIT');
                        cacheHeaders.set('X-Edge-Cache', 'HIT');
                        cacheHeaders.delete('set-cookie');
                        cacheHeaders.delete('pragma');
                        cacheHeaders.delete('expires');
                        const cacheResponse = new Response(bodyText, {
                            status: response.status,
                            statusText: response.statusText,
                            headers: cacheHeaders
                        });
                        if (ctx && ctx.waitUntil) {
                            ctx.waitUntil(cache.put(cacheKey, cacheResponse));
                        }
                    }
                }

                // If modifying data (POST/PUT/DELETE), purge the relevant GET cache
                if (request.method !== 'GET' && (url.pathname.startsWith('/api/presets') || url.pathname.startsWith('/api/resources') || url.pathname.startsWith('/api/socials') || url.pathname.startsWith('/api/contacts'))) {
                    const purgeUrl = new URL(url.pathname.split('/').slice(0, 3).join('/'), url.origin);
                    if (ctx && ctx.waitUntil) {
                        ctx.waitUntil(cache.delete(new Request(purgeUrl.origin + purgeUrl.pathname, { method: 'GET' })));
                    }
                }

                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: newHeaders
                });
            } catch (err) {
                return new Response(JSON.stringify({ error: 'Backend proxy error', details: err.message }), {
                    status: 502,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': corsOrigin
                    }
                });
            }
        }

        // Delegate static asset serving to Cloudflare Assets binding
        if (env.ASSETS) {
            return env.ASSETS.fetch(request);
        }

        return new Response('Not found', { status: 404 });
    }
};
