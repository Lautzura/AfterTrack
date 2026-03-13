// Aftertrack Service Worker - Push Notifications
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || 'Aftertrack';
  const options = {
    body: data.body || 'Tenés una nueva notificación',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
    vibrate: [100, 50, 100],
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type:'window' }).then(list => {
      if (list.length > 0) { list[0].focus(); return; }
      clients.openWindow(e.notification.data.url || '/');
    })
  );
});
