// Service Worker for HomeCrew Customer PWA & Firebase Cloud Messaging
// Strategy: Cache-first for app shell; network-first for API/supabase calls.
const CACHE_NAME = 'homecrew-customer-v3';
const OFFLINE_URL = '/';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
];

// ── Install: pre-cache the app shell ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
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

// ── Fetch strategy ────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Always network-first for Supabase API or external URLs
  const isApi = url.hostname.includes('supabase') || url.hostname.includes('googleapis');
  if (isApi) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for everything else (JS, CSS, images, HTML)
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached || caches.match(OFFLINE_URL));

      return cached || networkFetch;
    })
  );
});

// ── Push notification handler ─────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try { data = event.data.json(); }
    catch { data = { body: event.data.text() }; }
  }

  const title       = data.title       || data.notification?.title || 'HomeCrew Alert';
  const body        = data.body        || data.notification?.body  || 'You have a new update.';
  const payloadData = data.data || data;

  const isEmergency = payloadData.priority === 'emergency' || payloadData.type === 'emergency_alert';

  const options = {
    body,
    icon:  data.icon || data.notification?.icon || '/favicon.svg',
    badge: '/favicon.svg',
    image: payloadData.image_url || undefined,
    data:  payloadData,
    vibrate: isEmergency ? [300, 100, 300, 100, 300] : [200, 100, 200],
    requireInteraction: isEmergency,
    tag: payloadData.notification_id || 'homecrew-notif',
    renotify: true,
    actions: payloadData.actions || (isEmergency
      ? [{ action: 'interested', title: 'Interested ✋' }, { action: 'not_interested', title: 'Skip' }]
      : []),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click handler ────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data      = event.notification.data || {};
  let   targetUrl = data.url || '/';

  if (event.action === 'interested')     targetUrl += (targetUrl.includes('?') ? '&' : '?') + 'interest=yes';
  if (event.action === 'not_interested') targetUrl += (targetUrl.includes('?') ? '&' : '?') + 'interest=no';
  if (data.notification_id)              targetUrl += (targetUrl.includes('?') ? '&' : '?') + `notif_id=${data.notification_id}`;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if ('focus' in win) {
          win.navigate(targetUrl);
          return win.focus();
        }
      }
      return clients.openWindow?.(targetUrl);
    })
  );
});

// ── Background sync placeholder (future) ─────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-actions') {
    // Future: replay queued mutations stored in IndexedDB
    console.log('[SW] Background sync triggered:', event.tag);
  }
});