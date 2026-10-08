import { getEnvTrollHtml } from './_utils/env-troll.js';

export async function onRequest(context) {
    const url = new URL(context.request.url);

    // 🐟 Cutefish Shield Easter Egg: Catch anyone probing .env files
    if (url.pathname.toLowerCase().includes('.env')) {
        const clientIp = context.request.headers.get('cf-connecting-ip') || 
                         context.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                         '127.0.0.1';
        const userAgent = context.request.headers.get('user-agent') || 'Unknown Device';
        return new Response(getEnvTrollHtml(clientIp, userAgent, url.pathname), {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'X-Robots-Tag': 'noindex, nofollow'
            }
        });
    }

    return context.next();
}
