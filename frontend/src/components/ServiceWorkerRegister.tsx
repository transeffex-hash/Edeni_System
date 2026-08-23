"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker.
 *
 * Notes:
 * - We register on the client only.
 * - This is intentionally tiny and isolated so it’s easy to remove/modify later.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        // Unregister any stale service workers first so old caches are cleared
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }

        // Register the new service worker
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.register("/firebase-messaging-sw.js");

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "activated" && navigator.serviceWorker.controller) {
              window.location.reload();
            }
          });
        });
      } catch {
        // SW registration failed — app still works without it
      }
    };

    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(register);
    } else {
      setTimeout(register, 1000);
    }
  }, []);

  return null;
}
