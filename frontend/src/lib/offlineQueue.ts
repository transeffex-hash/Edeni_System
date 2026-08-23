type QueuedRequest = {
  id: string;
  path: string;
  method: string;
  body: unknown;
  timestamp: number;
};

const STORAGE_KEY = "edeni_offline_queue";

function readQueue(): QueuedRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedRequest[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedRequest[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // ignore storage errors
  }
}

export const OfflineQueue = {
  enqueue(req: { path: string; method: string; body: unknown }) {
    const queue = readQueue();
    queue.push({ ...req, id: crypto.randomUUID(), timestamp: Date.now() });
    writeQueue(queue);
  },

  getQueue(): QueuedRequest[] {
    return readQueue();
  },

  remove(id: string) {
    const queue = readQueue().filter((q) => q.id !== id);
    writeQueue(queue);
  },

  dequeueAll(): QueuedRequest[] {
    const queue = readQueue();
    writeQueue([]);
    return queue;
  },

  size(): number {
    return readQueue().length;
  },

  async flush(apiBase: string) {
    const items = this.dequeueAll();
    for (const item of items) {
      try {
        await fetch(apiBase + item.path, {
          method: item.method,
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.body),
        });
      } catch {
        // re-queue on failure
        this.enqueue({ path: item.path, method: item.method, body: item.body });
        break;
      }
    }
  },
};
