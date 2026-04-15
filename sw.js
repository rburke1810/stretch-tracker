// StretchTracker — Service Worker
// Handles: offline caching, push events (from server), notification click routing

const CACHE_NAME = 'stretchtracker-v2'

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/data.js',
  './js/state.js',
  './js/session.js',
  './js/notifications.js',
  './js/ui.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/apple-touch-icon.png'
]

// ===== Install: cache all app shell assets =====
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => {
        // Don't fail install if some icons aren't present yet
        console.warn('SW install cache partial:', err)
        return self.skipWaiting()
      })
  )
})

// ===== Activate: clean up old caches =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE_NAME)
            .map(k => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

// ===== Fetch: cache-first for all requests =====
self.addEventListener('fetch', event => {
  // Only handle GET requests to same origin
  if (event.request.method !== 'GET') return
  if (!event.request.url.startsWith(self.location.origin)) return

  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request).then(response => {
        // Cache new responses dynamically
        if (response && response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      }))
      .catch(() => caches.match('./index.html'))
  )
})

// ===== Notification Click: route back into the app =====
self.addEventListener('notificationclick', event => {
  const notification = event.notification
  const category = (notification.data && notification.data.category) || 'carpal'

  notification.close()

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // If app window is already open, focus it and send a message
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus()
            client.postMessage({ type: 'START_SESSION', category })
            return
          }
        }
        // Otherwise open a new window with a start param
        if (self.clients.openWindow) {
          return self.clients.openWindow(`./?start=${category}`)
        }
      })
  )
})

// ===== Push Event: fired by the Cloudflare Worker push server =====
self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Time to Stretch! 🙌', body: 'Open the app to start your session.', category: 'carpal' }
  }

  const title = data.title || 'Time to Stretch! 🙌'
  const options = {
    body:    data.body   || 'Time for your stretch session.',
    icon:    './icons/icon-192.png',
    badge:   './icons/icon-192.png',
    data:    { category: data.category || 'carpal' },
    tag:     `stretch-${data.category || 'carpal'}`,
    actions: [{ action: 'start', title: 'Start Now' }],
    requireInteraction: false
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ===== Message Handler =====
self.addEventListener('message', event => {
  const { type } = event.data || {}
  if (type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
