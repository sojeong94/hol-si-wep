// 홀시 Web Push 핸들러 - Service Worker에서 실행됩니다
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || '홀시'
  const options = {
    body: data.body || '영양제 챙겨요!',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: data.tag || 'holsi-pill',
    renotify: true,
    requireInteraction: false,
    silent: false,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow('/')
    })
  )
})
