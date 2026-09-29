export async function onRequest(context) {
    const url = new URL(context.request.url);
    const chinoUrl = new URL(url.pathname + url.search, 'https://upscale.chino.icu');

    const headers = new Headers(context.request.headers);
    headers.set('host', chinoUrl.host);

    const init = {
        method: context.request.method,
        headers: headers,
        redirect: 'follow'
    };

    if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
        init.body = context.request.body;
    }

    try {
        let response = await fetch(chinoUrl.toString(), init);
        if (!response.ok && context.env.BACKEND_API_URL) {
            const fallbackUrl = new URL(url.pathname + url.search, context.env.BACKEND_API_URL);
            const fbHeaders = new Headers(context.request.headers);
            fbHeaders.set('host', fallbackUrl.host);
            if (context.env.PROXY_SECRET) fbHeaders.set('x-cf-secret', context.env.PROXY_SECRET);
            response = await fetch(fallbackUrl.toString(), { ...init, headers: fbHeaders });
        }
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');
        newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        newHeaders.set('Cache-Control', 'public, max-age=604800, s-maxage=604800');
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Realesrgan proxy failed', details: err.message }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
}
