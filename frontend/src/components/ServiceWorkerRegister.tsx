"use client";

import { useEffect } from "react";

import { registerFirebaseWebPushPlaceholder } from "@/lib/firebaseWebPush";

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
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // Register after the page becomes idle to avoid slowing initial render.
    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
        registerFirebaseWebPushPlaceholder();
      } catch {
        // In production you might log this to an error tracker.
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
