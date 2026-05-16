self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'New Message';
    const options = {
        body: data.body || '',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: data.tag || 'chat-notification',
        renotify: true,
        data: { url: data.url || '/admin.html#chat' }
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/admin.html#chat';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if (client.url.includes('admin.html') && 'focus' in client) {
                    return client.focus();
                }
            }
            return self.clients.openWindow(targetUrl);
        })
    );
});
