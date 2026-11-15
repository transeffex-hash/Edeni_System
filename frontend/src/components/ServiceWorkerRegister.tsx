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
      // Local development: never run a service worker. Unregister any old one
      // and wipe its caches so the browser always loads the freshest code.
      if (["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        } catch {
          // ignore
        }
        return;
      }
      try {
        // Register the app service worker only.
        // The Firebase messaging SW is registered on demand (with its own scope)
        // by firebaseWebPush.ts when notifications are enabled.
        const registration = await navigator.serviceWorker.register("/sw.js");

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
