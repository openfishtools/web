const CACHE_NAME = 'chros-offline-v1.2.2';

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

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.all(
                CORE_ASSETS.map((asset) => {
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
    if (event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
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
        caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
            if (cachedResponse) {
                // Return cached version immediately, but refresh cache in background if online
                fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
                    }
                }).catch(() => {});
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
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
