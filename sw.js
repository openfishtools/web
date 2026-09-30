// Self-destructing service worker.
// Purpose: clean up legacy service workers & Cache API storage from old
// deployments. It registers no fetch handler, wipes all caches,
// unregisters itself, and reloads any open clients once.

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        try {
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));
        } catch (e) {}

        try {
            await self.registration.unregister();
        } catch (e) {}
    })());
});
