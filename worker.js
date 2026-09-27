export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // Handle CORS Preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-requested-with'
                }
            });
        }

        // Proxy API and RealESRGAN requests to Vercel Backend with Security Shield & Edge Caching
        if (url.pathname.startsWith('/api') || url.pathname.startsWith('/realesrgan')) {
            const backendOrigin = env.BACKEND_API_URL || 'https://editorstuff.vercel.app';
            const targetUrl = new URL(url.pathname + url.search, backendOrigin);

            // Cloudflare Edge Cache for public read-only GET endpoints (Saves Vercel Limits)
            const isCacheableGet = request.method === 'GET' && (
                url.pathname === '/api/presets' ||
                url.pathname === '/api/socials' ||
                url.pathname === '/api/contacts' ||
                url.pathname === '/api/resources' ||
                url.pathname === '/api/version'
            );

            const cache = caches.default;
            const cacheKey = new Request(url.toString(), request);

            if (isCacheableGet) {
                const cachedResponse = await cache.match(cacheKey);
                if (cachedResponse) {
                    const hitHeaders = new Headers(cachedResponse.headers);
                    hitHeaders.set('x-cf-cache-status', 'HIT');
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
                newHeaders.set('Access-Control-Allow-Origin', '*');
                newHeaders.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
                newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-requested-with');

                // Cache successful GET responses in Cloudflare's Edge CDN for 60 seconds
                if (isCacheableGet && response.ok) {
                    newHeaders.set('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');
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
                        ctx.waitUntil(cache.delete(new Request(purgeUrl.toString())));
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
                        'Access-Control-Allow-Origin': '*'
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
