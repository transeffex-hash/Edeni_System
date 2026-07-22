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

export async function registerFirebaseWebPushPlaceholder(): Promise<{ ok: boolean; reason?: string }> {
  if (typeof window === "undefined") return { ok: false, reason: "server" };
  if (!("Notification" in window)) return { ok: false, reason: "unsupported" };

  const cfg = getFirebaseWebPushConfig();
  if (!cfg) return { ok: false, reason: "missing_env" };

  return { ok: false, reason: "not_implemented" };
}
