// Service Worker for HomeCrew Admin PWA
// Strategy: network-first for all resources (admin is always online).
const CACHE_NAME = 'homecrew-admin-v3';
const OFFLINE_URL = '/';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (_event) => {
  self.skipWaiting();
});

// ── Activate: delete old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first with offline fallback ────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((r) => r || caches.match(OFFLINE_URL)))
  );
});

// ── Push notifications (admin alerts) ─────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try { data = event.data.json(); }
    catch { data = { body: event.data.text() }; }
  }

  const title       = data.title || data.notification?.title || 'HomeCrew Admin Alert';
  const body        = data.body  || data.notification?.body  || 'Platform event logged.';
  const payloadData = data.data || data;

  const options = {
    body,
    icon:    data.icon || data.notification?.icon || '/favicon.svg',
    badge:   '/favicon.svg',
    image:   payloadData.image_url || undefined,
    data:    payloadData,
    vibrate: [200, 100, 200],
    tag:     payloadData.notification_id || 'homecrew-admin-notif',
    actions: payloadData.actions || [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data      = event.notification.data || {};
  let   targetUrl = data.url || '/';
  if (data.notification_id) {
    targetUrl += (targetUrl.includes('?') ? '&' : '?') + `notif_id=${data.notification_id}`;
  }
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if ('focus' in win) { win.navigate(targetUrl); return win.focus(); }
      }
      return clients.openWindow?.(targetUrl);
    })
  );
});
