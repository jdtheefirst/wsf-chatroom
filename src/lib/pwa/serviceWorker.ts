// lib/pwa/serviceWorker.ts

export async function registerServiceWorker() {
  if (typeof window === "undefined") return;

  if ("serviceWorker" in navigator && "PushManager" in window) {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      console.log("[PWA] Service Worker registered:", registration);

      // Check for existing subscription
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        console.log("[PWA] Existing push subscription found");
        await syncSubscriptionWithServer(subscription);
      }

      return registration;
    } catch (error) {
      console.error("[PWA] Service Worker registration failed:", error);
    }
  }
  return null;
}

export async function subscribeToPushNotifications() {
  if (typeof window === "undefined") return null;

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("[PWA] Push notifications not supported");
    return null;
  }

  try {
    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[PWA] Notification permission denied");
      return null;
    }

    const registration = await navigator.serviceWorker.ready;

    // Get VAPID public key from your server
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.error("[PWA] VAPID public key missing");
      return null;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    // Send subscription to your server
    await saveSubscriptionToServer(subscription);

    console.log("[PWA] Push subscription successful");
    return subscription;
  } catch (error) {
    console.error("[PWA] Failed to subscribe to push:", error);
    return null;
  }
}

export async function unsubscribeFromPushNotifications() {
  if (typeof window === "undefined") return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      await removeSubscriptionFromServer(subscription);
      console.log("[PWA] Unsubscribed from push notifications");
    }
  } catch (error) {
    console.error("[PWA] Failed to unsubscribe:", error);
  }
}

// Helper: Convert VAPID key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

async function saveSubscriptionToServer(subscription: PushSubscription) {
  try {
    await fetch("/api/pwa/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });
  } catch (error) {
    console.error("[PWA] Failed to save subscription:", error);
  }
}

async function removeSubscriptionFromServer(subscription: PushSubscription) {
  try {
    await fetch("/api/pwa/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  } catch (error) {
    console.error("[PWA] Failed to remove subscription:", error);
  }
}

async function syncSubscriptionWithServer(subscription: PushSubscription) {
  await saveSubscriptionToServer(subscription);
}
