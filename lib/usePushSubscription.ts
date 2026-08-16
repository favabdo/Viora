"use client";

import { useCallback, useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function usePushSubscription() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    const isSupported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
    setSupported(isSupported);
    if (!isSupported) return;

    navigator.serviceWorker.register("/push-sw.js").then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();
      setSubscribed(!!existing);
    });
  }, []);

  const subscribe = useCallback(async () => {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      console.error("[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY مش متضاف");
      return false;
    }
    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return false;

      const registration = await navigator.serviceWorker.register("/push-sw.js");
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) return false;

      setSubscribed(true);
      return true;
    } catch (err) {
      console.error("[Push] فشل الاشتراك:", err);
      return false;
    } finally {
      setSubscribing(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      console.error("[Push] فشل إلغاء الاشتراك:", err);
    }
  }, []);

  return { supported, subscribed, subscribing, subscribe, unsubscribe };
}
