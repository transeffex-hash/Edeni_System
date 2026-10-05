import { getApps, initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { apiPost } from "./api";

export type FirebaseWebPushConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
};

export function getFirebaseWebPushConfig(): FirebaseWebPushConfig | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId || !vapidKey) return null;

  return { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId, vapidKey };
}

let _messaging: ReturnType<typeof getMessaging> | null = null;

async function getMessagingServiceWorker() {
  if (!("serviceWorker" in navigator)) throw new Error("service_worker_unsupported");
  // Dedicated scope so it doesn't replace the main app SW registered at "/".
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
    scope: "/firebase-cloud-messaging-push-scope",
  });
  await navigator.serviceWorker.ready;
  return registration;
}

function getMsg() {
  const cfg = getFirebaseWebPushConfig();
  if (!cfg) return null;
  if (!getApps().length) initializeApp(cfg);
  if (!_messaging) _messaging = getMessaging();
  return _messaging;
}

export async function registerForPushNotifications(): Promise<{ ok: boolean; token?: string; reason?: string }> {
  if (typeof window === "undefined") return { ok: false, reason: "server" };
  if (!("Notification" in window)) return { ok: false, reason: "unsupported" };
  const cfg = getFirebaseWebPushConfig();
  if (!cfg) return { ok: false, reason: "missing_env" };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "permission_denied" };
  try {
    const msg = getMsg();
    if (!msg) return { ok: false, reason: "init_failed" };
    const serviceWorkerRegistration = await getMessagingServiceWorker();
    const token = await getToken(msg, { vapidKey: cfg.vapidKey, serviceWorkerRegistration });
    if (!token) return { ok: false, reason: "no_token" };
    await apiPost("/api/notifications/register-device", { token });
    return { ok: true, token };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? "error" };
  }
}

export async function registerAdminForPushNotifications(): Promise<{ ok: boolean; token?: string; reason?: string }> {
  if (typeof window === "undefined") return { ok: false, reason: "server" };
  if (!("Notification" in window)) return { ok: false, reason: "unsupported" };
  const cfg = getFirebaseWebPushConfig();
  if (!cfg) return { ok: false, reason: "missing_env" };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "permission_denied" };
  try {
    const msg = getMsg();
    if (!msg) return { ok: false, reason: "init_failed" };
    const serviceWorkerRegistration = await getMessagingServiceWorker();
    const token = await getToken(msg, { vapidKey: cfg.vapidKey, serviceWorkerRegistration });
    if (!token) return { ok: false, reason: "no_token" };
    await apiPost("/api/admin/register-device", { token });
    return { ok: true, token };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? "error" };
  }
}

export function onForegroundMessage(cb: (payload: any) => void) {
  const msg = getMsg();
  if (!msg) return null;
  return onMessage(msg, cb);
}
