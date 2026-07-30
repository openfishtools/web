const CACHE_NAME = 'chros-offline-v1.2.4';

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles/main.css',
    '/styles/responsive.css',
    '/scripts/app.js',
    '/scripts/i18n.js',
    '/scripts/ffmpeg-tool.js',
    '/scripts/tiktok-quality-tool.js',
    '/scripts/tiktok-stats-tool.js',
    '/scripts/tiktok-downloader.js',
    '/scripts/upscale-gpu-enhancer.js',
    '/scripts/upscale-tool.js',
    '/scripts/video-interpolation.js',
    '/scripts/image-sequence-tool.js',
    '/scripts/fivemb-generator.js',
    '/scripts/ae-to-am-beatmark-tool.js',
    '/assets/jszip/jszip.min.js',
    '/assets/fonts/brand-icons.css'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME && cache !== 'chros-offline-assets-v1' && !cache.startsWith('chros-offline')) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Skip caching for backend API endpoints
    if (url.pathname.startsWith('/api/')) return;

    // Handle HTML Navigation Requests (e.g. www.cutefish.my.id/#tools while offline)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                    }
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match('/index.html', { ignoreSearch: true }).then((cachedIndex) => {
                        return cachedIndex || caches.match('/', { ignoreSearch: true });
                    });
                })
        );
        return;
    }

    // Static Assets Strategy: Cache First, fallback to Network with dynamic caching
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then(async (cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            try {
                const cacheNames = [CACHE_NAME, 'chros-offline-assets-v1', 'chros-offline-v1'];
                for (const name of cacheNames) {
                    if (await caches.has(name)) {
                        const cache = await caches.open(name);
                        const match = await cache.match(event.request, { ignoreSearch: true }) ||
                                      await cache.match(url.pathname, { ignoreSearch: true }) ||
                                      await cache.match(url.href, { ignoreSearch: true }) ||
                                      await cache.match(url.pathname.replace(/^\//, ''), { ignoreSearch: true });
                        if (match) return match;
                    }
                }
            } catch (e) {}

            return fetch(event.request).then((networkResponse) => {
                if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                }
                return networkResponse;
            }).catch(() => {
                return new Response('Offline content unavailable', { status: 503, statusText: 'Offline' });
            });
        })
    );
});
