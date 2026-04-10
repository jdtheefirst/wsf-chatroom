// public/sw.js
const CACHE_NAME = "wsf-chat-v1";
const OFFLINE_URL = "/offline";

// Install event - cache essential assets
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Installing...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        "/",
        "/offline",
        "/manifest.json",
        "/android-chrome-192x192.png",
        "/android-chrome-512x512.png",
      ]);
    }),
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activating...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("[Service Worker] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

// Handle messages from the client (including badge updates)
self.addEventListener("message", (event) => {
  if (!event.data) return;

  const { type, count, priority, message } = event.data;

  switch (type) {
    case "UPDATE_BADGE":
      // Update app badge on home screen
      if ("setAppBadge" in self.navigator) {
        if (count > 0) {
          self.navigator.setAppBadge(count);
          console.log(`[Service Worker] Badge updated to: ${count}`);
        } else {
          self.navigator.clearAppBadge();
          console.log("[Service Worker] Badge cleared");
        }
      }
      break;

    case "SHOW_NOTIFICATION":
      // Show immediate notification (for urgent messages)
      if (priority === "urgent" || priority === "announcement") {
        const options = {
          body: message.body || "You have a new message",
          icon: message.icon || "/icons/icon-192x192.png",
          badge: "/icons/badge-72x72.png",
          vibrate: [200, 100, 200],
          tag: message.tag || "chat-message",
          renotify: true,
          requireInteraction: priority === "announcement", // Stay until user interacts
          data: {
            url: message.url,
            messageId: message.messageId,
            chatroomId: message.chatroomId,
          },
          actions: [
            {
              action: "open",
              title: "Open Chat",
            },
            {
              action: "dismiss",
              title: "Dismiss",
            },
          ],
        };

        event.waitUntil(
          self.registration.showNotification(
            message.title || "WSF Chat",
            options,
          ),
        );
      }
      break;

    case "GET_BADGE":
      // Return current badge count
      if ("getAppBadge" in self.navigator) {
        self.navigator.getAppBadge().then((badgeCount) => {
          event.source.postMessage({ type: "BADGE_COUNT", count: badgeCount });
        });
      } else {
        event.source.postMessage({ type: "BADGE_COUNT", count: 0 });
      }
      break;
  }
});

// Handle push notifications from server
self.addEventListener("push", (event) => {
  console.log("[Service Worker] Push received:", event);

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: "New Message",
        body: event.data.text(),
        icon: "/icons/icon-192x192.png",
        badge: "/icons/badge-72x72.png",
      };
    }
  }

  const options = {
    body: data.body || "You have a new message in chat",
    icon: data.icon || "/icons/icon-192x192.png",
    badge: data.badge || "/icons/badge-72x72.png",
    vibrate:
      data.priority === "urgent" ? [300, 150, 300, 150, 300] : [200, 100, 200],
    tag: data.tag || "chat-message",
    renotify: true,
    requireInteraction: data.priority === "announcement",
    data: {
      url: data.url || "/",
      messageId: data.messageId,
      chatroomId: data.chatroomId,
      priority: data.priority,
    },
    actions: [
      {
        action: "open",
        title: "Open Chat",
      },
      {
        action: "dismiss",
        title: "Dismiss",
      },
    ],
  };

  // Add custom sounds for different priorities
  if (data.priority === "urgent") {
    options.silent = false;
    // Urgent sound is handled by the OS notification sound
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "WSF Chat", options),
  );
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  console.log("[Service Worker] Notification click:", event);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/";
  const messageId = event.notification.data?.messageId;
  const chatroomId = event.notification.data?.chatroomId;

  // Construct URL with messageId if available
  let finalUrl = urlToOpen;
  if (chatroomId && messageId) {
    finalUrl = `/chatrooms/${chatroomId}?messageId=${messageId}`;
  } else if (chatroomId) {
    finalUrl = `/chatrooms/${chatroomId}`;
  }

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Try to find an existing window/tab
        for (const client of clientList) {
          if (
            client.url.includes(finalUrl.split("?")[0]) &&
            "focus" in client
          ) {
            client.postMessage({
              type: "FOCUS_MESSAGE",
              messageId: messageId,
              chatroomId: chatroomId,
            });
            return client.focus();
          }
        }
        // If no existing window, open a new one
        if (clients.openWindow) {
          return clients.openWindow(finalUrl);
        }
      }),
  );
});

// Handle background sync for failed messages
self.addEventListener("sync", (event) => {
  console.log("[Service Worker] Background sync:", event.tag);

  if (event.tag === "send-message-sync") {
    event.waitUntil(sendPendingMessages());
  } else if (event.tag === "retry-notifications") {
    event.waitUntil(retryFailedNotifications());
  }
});

// Function to send pending messages when back online
async function sendPendingMessages() {
  const cache = await caches.open("pending-messages");
  const pendingMessages = await cache.keys();

  for (const request of pendingMessages) {
    try {
      const response = await fetch(request);
      if (response.ok) {
        await cache.delete(request);
        console.log("[Service Worker] Sent pending message successfully");
      }
    } catch (error) {
      console.error("[Service Worker] Failed to send pending message:", error);
    }
  }
}

// Function to retry failed notifications
async function retryFailedNotifications() {
  const cache = await caches.open("failed-notifications");
  const failedNotifications = await cache.keys();

  for (const request of failedNotifications) {
    try {
      const response = await fetch(request);
      if (response.ok) {
        await cache.delete(request);
        console.log("[Service Worker] Retried notification successfully");
      }
    } catch (error) {
      console.error("[Service Worker] Failed to retry notification:", error);
    }
  }
}

// Fetch event for offline support
self.addEventListener("fetch", (event) => {
  // Don't cache API requests
  if (event.request.url.includes("/api/")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return (
        response ||
        fetch(event.request).catch(() => {
          // If offline and request is for a page, show offline page
          if (event.request.mode === "navigate") {
            return caches.match(OFFLINE_URL);
          }
          return new Response("Offline", { status: 503 });
        })
      );
    }),
  );
});
