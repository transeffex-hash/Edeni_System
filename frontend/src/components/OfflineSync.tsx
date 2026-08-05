"use client";

import { useEffect, useState } from "react";
import { OfflineQueue } from "@/lib/offlineQueue";
import { API_BASE } from "@/lib/api";

export default function OfflineSync() {
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = async () => {
      const q = OfflineQueue.getQueue();
      if (q.length === 0) return;

      setSyncing(true);
      for (const req of q) {
        try {
          const res = await fetch(API_BASE + req.path, {
            method: req.method,
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req.body)
          });

          // Remove if successful or if it's a client error (e.g., 400 Bad Request)
          // so it doesn't get stuck in the queue forever.
          // Keep it in the queue if it's a server error (5xx) or network failure.
          if (res.ok || (res.status >= 400 && res.status < 500)) {
            OfflineQueue.remove(req.id);
          }
        } catch (e) {
          // Network error: leave in queue to try again later
        }
      }
      setSyncing(false);
    };

    window.addEventListener("online", handleOnline);

    // Also attempt sync on initial mount if we are online
    if (navigator.onLine) {
      handleOnline();
    }

    return () => window.removeEventListener("online", handleOnline);
  }, []);

  if (!syncing) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black text-white px-4 py-2 rounded shadow-lg text-sm z-50 flex items-center gap-2">
      <span className="animate-spin inline-block w-4 h-4 border-2 border-t-transparent rounded-full border-white"></span>
      <span>Syncing offline transactions...</span>
    </div>
  );
}
