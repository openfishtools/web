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

    const backendOrigin = context.env.BACKEND_API_URL || 'https://editorstuff.vercel.app';
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

    if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
        init.body = context.request.body;
    }

    try {
        const response = await fetch(targetUrl.toString(), init);
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', corsOrigin);
        newHeaders.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
        newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-requested-with');

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
