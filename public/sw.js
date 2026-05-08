/**
 * Dirac Service Worker for Push Notifications
 * Handles incoming push events and displays native notifications
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
 */

const CACHE_NAME = 'dirac-push-v1';
const NOTIFICATION_ICON = '/icon-192.png';
const DEFAULT_BADGE = '/badge-72.png';

// ============================================================================
// Push Event Handler
// ============================================================================

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const notification = buildNotification(data);
    
    event.waitUntil(
      self.registration.showNotification(notification.title, notification)
    );
  } catch (error) {
    console.error('[Push] Failed to parse push data:', error);
  }
});

// ============================================================================
// Notification Click Handler
// ============================================================================

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const data = event.notification.data || {};
  const urlToOpen = data.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if open
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// ============================================================================
// Install Event - Cache Assets
// ============================================================================

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/offline.html',
      ]);
    })
  );
  self.skipWaiting();
});

// ============================================================================
// Activate Event - Clean Old Caches
// ============================================================================

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// ============================================================================
// Helper Functions
// ============================================================================

function buildNotification(data) {
  return {
    body: data.body || '',
    icon: data.icon || NOTIFICATION_ICON,
    badge: data.badge || DEFAULT_BADGE,
    tag: data.tag || 'dirac-notification',
    data: data.data || {},
    requireInteraction: data.requireInteraction || false,
    vibrate: data.urgency === 'critical' ? [200, 100, 200] : [100],
    actions: buildActions(data.type),
    timestamp: data.timestamp || Date.now(),
  };
}

function buildActions(type) {
  switch (type) {
    case 'urgent_email':
      return [
        { action: 'open', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
    case 'reply_received':
      return [
        { action: 'reply', title: 'Reply' },
        { action: 'open', title: 'View' },
      ];
    case 'ai_digest':
      return [
        { action: 'view', title: 'View Summary' },
      ];
    default:
      return [];
  }
}

// ============================================================================
// Push Subscription Management
// ============================================================================

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SUBSCRIBE') {
    handleSubscription(event.data.subscription);
  } else if (event.data?.type === 'UNSUBSCRIBE') {
    handleUnsubscription(event.data.endpoint);
  }
});

async function handleSubscription(subscription) {
  // Send subscription to server
  try {
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription),
    });
    
    if (!response.ok) {
      console.error('[Push] Failed to subscribe:', response.status);
    }
  } catch (error) {
    console.error('[Push] Subscription error:', error);
  }
}

async function handleUnsubscription(endpoint) {
  try {
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });
  } catch (error) {
    console.error('[Push] Unsubscription error:', error);
  }
}
