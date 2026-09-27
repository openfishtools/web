export async function onRequest(context) {
    const url = new URL(context.request.url);
    const backendOrigin = context.env.BACKEND_API_URL || 'https://cutefish.my.id';
    const targetUrl = new URL(url.pathname + url.search, backendOrigin);

    const headers = new Headers(context.request.headers);
    headers.set('host', targetUrl.host);

    const init = {
        method: context.request.method,
        headers: headers,
        redirect: 'follow'
    };

    if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
        init.body = context.request.body;
    }

    try {
        const response = await fetch(targetUrl.toString(), init);
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Backend proxy failed', details: err.message }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
