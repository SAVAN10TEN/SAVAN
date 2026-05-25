const CACHE_NAME = 'amedi-tv-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        console.warn('Pre-caching assets failed, caching dynamically instead.', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Only handle standard GET requests
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  // Do not cache API proxy or WebSockets
  if (url.pathname.startsWith('/api/') || url.pathname.includes('websocket')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Return cached, and fetch fresh in background for static assets
        fetch(event.request)
          .then(networkResponse => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).then(networkResponse => {
        if (networkResponse.status === 200 && url.origin === self.location.origin) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cacheCopy));
        }
        return networkResponse;
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', event => {
  let data = { title: 'AMEDI TV Update', body: 'New Kurdish channels or updates are available!' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'AMEDI TV Update', body: event.data.text() };
    }
  }
  const options = {
    body: data.body,
    icon: 'https://i.postimg.cc/QxGcmFd3/file-0000000004b47246b78b315ac6479e1d.png',
    badge: 'https://i.postimg.cc/QxGcmFd3/file-0000000004b47246b78b315ac6479e1d.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let i = 0; i < windowClients.length; i++) {
        let client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
