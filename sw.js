const APP_VERSION = '1.7.3';
const CACHE_NAME = `chros-offline-v${APP_VERSION}`;

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
    '/scripts/rembg-tool.js',
    '/assets/jszip/jszip.min.js',
    '/favicon.ico'
];

const TOOL_VERSIONS = {
    'main.css': '1.6.9',
    'responsive.css': '1.6.9',
    'i18n.js': '1.6.9',
    'app.js': '1.6.9',
    'ffmpeg-tool.js': '1.0.0',
    'tiktok-quality-tool.js': '3.0.4',
    'audio-extractor-tool.js': '1.0.0',
    'image-sequence-tool.js': '1.0.0',
    'fivemb-generator.js': '1.0.0',
    'ae-to-am-beatmark-tool.js': '1.0.0',
    'upscale-gpu-enhancer.js': '1.0.0',
    'upscale-tool.js': '1.0.0',
    'video-interpolation.js': '1.0.2',
    'rembg-tool.js': '1.3.8',
    'tiktok-stats-tool.js': '1.0.1',
    'tiktok-downloader.js': '1.0.0'
};

const VERSIONED_ASSETS = [
    `/styles/main.css?v=${TOOL_VERSIONS['main.css']}`,
    `/styles/responsive.css?v=${TOOL_VERSIONS['responsive.css']}`,
    `/scripts/i18n.js?v=${TOOL_VERSIONS['i18n.js']}`,
    `/scripts/app.js?v=${TOOL_VERSIONS['app.js']}`,
    `/scripts/ffmpeg-tool.js?v=${TOOL_VERSIONS['ffmpeg-tool.js']}`,
    `/scripts/tiktok-quality-tool.js?v=${TOOL_VERSIONS['tiktok-quality-tool.js']}`,
    `/scripts/audio-extractor-tool.js?v=${TOOL_VERSIONS['audio-extractor-tool.js']}`,
    `/scripts/image-sequence-tool.js?v=${TOOL_VERSIONS['image-sequence-tool.js']}`,
    `/scripts/fivemb-generator.js?v=${TOOL_VERSIONS['fivemb-generator.js']}`,
    `/scripts/ae-to-am-beatmark-tool.js?v=${TOOL_VERSIONS['ae-to-am-beatmark-tool.js']}`,
    `/scripts/upscale-gpu-enhancer.js?v=${TOOL_VERSIONS['upscale-gpu-enhancer.js']}`,
    `/scripts/upscale-tool.js?v=${TOOL_VERSIONS['upscale-tool.js']}`,
    `/scripts/video-interpolation.js?v=${TOOL_VERSIONS['video-interpolation.js']}`,
    `/scripts/rembg-tool.js?v=${TOOL_VERSIONS['rembg-tool.js']}`,
    `/scripts/tiktok-stats-tool.js?v=${TOOL_VERSIONS['tiktok-stats-tool.js']}`,
    `/scripts/tiktok-downloader.js?v=${TOOL_VERSIONS['tiktok-downloader.js']}`
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
        caches.match(event.request).then(async (cachedResponse) => {
            if (cachedResponse) return cachedResponse;

            if (url.search) {
                return fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
                    }
                    return networkResponse;
                });
            }

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
