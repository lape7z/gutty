// Notifiche del promemoria serale. Viene incluso nel service worker generato (vedi vite.config.ts).
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : undefined };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Gutty', {
      body: data.body || 'Com’è andata oggi?',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: 'gutty-promemoria',
      data: { url: self.registration.scope },
    }),
  );
});

// Toccando la notifica si apre Gutty (o si torna all'app se è già aperta).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of windows) if ('focus' in w) return w.focus();
      return self.clients.openWindow(event.notification.data?.url || './');
    })(),
  );
});
