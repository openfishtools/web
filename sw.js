const CACHE_NAME = 'chros-offline-v1.4.8';

const CORE_ASSETS = [
    '/',
    '/index.html',
    '/styles/main.css',
    '/styles/responsive.css',
    '/assets/fonts/brand-icons.css',
    '/scripts/i18n.js',
    '/scripts/app.js',
    '/scripts/ffmpeg-tool.js',
    '/scripts/audio-extractor-tool.js',
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
    '/favicon.ico'
];

const VERSIONED_ASSETS = [
    '/styles/main.css?v=1.4.8',
    '/styles/responsive.css?v=1.4.8',
    '/scripts/i18n.js?v=1.4.8',
    '/scripts/app.js?v=1.4.8',
    '/scripts/ffmpeg-tool.js?v=1.4.8',
    '/scripts/audio-extractor-tool.js?v=1.4.8',
    '/scripts/tiktok-quality-tool.js?v=1.4.8',
    '/scripts/tiktok-stats-tool.js?v=1.4.8',
    '/scripts/tiktok-downloader.js?v=1.4.8',
    '/scripts/upscale-gpu-enhancer.js?v=1.4.8',
    '/scripts/upscale-tool.js?v=1.4.8',
    '/scripts/video-interpolation.js?v=1.4.8',
    '/scripts/image-sequence-tool.js?v=1.4.8',
    '/scripts/fivemb-generator.js?v=1.4.8',
    '/scripts/ae-to-am-beatmark-tool.js?v=1.4.8'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            const allAssets = [...CORE_ASSETS, ...VERSIONED_ASSETS];
            await Promise.all(
                allAssets.map((asset) => {
                    return cache.add(asset).catch((err) => {
                        console.warn('[SW] Could not pre-cache asset:', asset, err);
                    });
                })
            );
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME && cache !== 'chros-offline-assets-v1') {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    if (url.pathname.startsWith('/api/')) return;

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

    if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
        return;
    }

    if (url.hostname.includes('cdn.jsdelivr.net')) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    const cacheNames = [CACHE_NAME, 'chros-offline-assets-v1'];
                    for (const name of cacheNames) {
                        if (await caches.has(name)) {
                            const cache = await caches.open(name);
                            const cleanPath = url.pathname.replace(/^\//, '');
                            const match = await cache.match(event.request, { ignoreSearch: true }) ||
                                          await cache.match(url.href, { ignoreSearch: true }) ||
                                          await cache.match(url.pathname, { ignoreSearch: true }) ||
                                          await cache.match(cleanPath, { ignoreSearch: true }) ||
                                          await cache.match('/' + cleanPath, { ignoreSearch: true });
                            if (match) return match;
                        }
                    }
                    return new Response('', { status: 503, statusText: 'Offline' });
                })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then(async (cachedResponse) => {
            if (cachedResponse) return cachedResponse;

            try {
                const cacheNames = [CACHE_NAME, 'chros-offline-assets-v1', 'chros-offline-v1'];
                for (const name of cacheNames) {
                    if (await caches.has(name)) {
                        const cache = await caches.open(name);
                        const cleanPath = url.pathname.replace(/^\//, '');
                        const match = await cache.match(event.request, { ignoreSearch: true }) ||
                                      await cache.match(url.pathname, { ignoreSearch: true }) ||
                                      await cache.match(url.href, { ignoreSearch: true }) ||
                                      await cache.match(cleanPath, { ignoreSearch: true });
                        if (match) return match;
                    }
                }
            } catch (e) {}

            return fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
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
