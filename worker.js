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

        // Proxy API requests to Vercel Backend with Security Shield & Edge Caching
        if (url.pathname.startsWith('/api')) {
            // 3. Browser direct address bar visit protection: redirect to home
            if (secFetchDest === 'document' && request.method === 'GET') {
                return Response.redirect('https://cutefish.my.id', 302);
            }

            const backendOrigin = env.BACKEND_API_URL || 'https://editorstuff.vercel.app';
            const targetUrl = new URL(url.pathname + url.search, backendOrigin);

            // Cloudflare Edge Cache for public read-only GET endpoints (Saves Vercel Limits)
            const isCacheableGet = request.method === 'GET' && (
                url.pathname === '/api/presets' ||
                url.pathname === '/api/socials' ||
                url.pathname === '/api/contacts' ||
                url.pathname === '/api/resources'
            );

            const cache = caches.default;
            const cacheKey = new Request(url.origin + url.pathname, { method: 'GET' });

            if (isCacheableGet) {
                const cachedResponse = await cache.match(cacheKey);
                if (cachedResponse) {
                    const hitHeaders = new Headers(cachedResponse.headers);
                    hitHeaders.set('x-cf-cache-status', 'HIT');
                    hitHeaders.set('Access-Control-Allow-Origin', corsOrigin);
                    return new Response(cachedResponse.body, {
                        status: cachedResponse.status,
                        statusText: cachedResponse.statusText,
                        headers: hitHeaders
                    });
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

                // Cache successful GET responses in Cloudflare's Edge CDN for 5 minutes (300 seconds)
                if (isCacheableGet && response.ok) {
                    newHeaders.set('Cache-Control', 'public, max-age=300, s-maxage=300');
                    const cacheResponse = new Response(response.clone().body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: newHeaders
                    });
                    if (ctx && ctx.waitUntil) {
                        ctx.waitUntil(cache.put(cacheKey, cacheResponse));
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
