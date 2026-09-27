export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // Redirect www to non-www
        if (url.hostname === 'www.cutefish.my.id') {
            return Response.redirect(`https://cutefish.my.id${url.pathname}${url.search}`, 301);
        }

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

        // Proxy API and RealESRGAN requests to Vercel Backend
        if (url.pathname.startsWith('/api') || url.pathname.startsWith('/realesrgan')) {
            const backendOrigin = env.BACKEND_API_URL || 'https://editorstuff.vercel.app';
            const targetUrl = new URL(url.pathname + url.search, backendOrigin);

            const headers = new Headers(request.headers);
            headers.set('host', targetUrl.host);

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
