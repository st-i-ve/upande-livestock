import { STORAGE_KEYS, storage } from "@/src/services/storage";

/**
 * Persistent queue of mutations that failed because the device was offline
 * (or the request never reached the server). Each entry is dispatched by
 * type via `src/offline/dispatcher.ts`.
 *
 * State is durable across app restarts. The queue is the single source of
 * truth — UI surfaces (count badges, pending list) subscribe to it.
 */

export type PendingMutationType =
  | "AnimalEvent"
  | "MilkRecording"
  | "AnimalDisposal"
  | "Animal"
  | "CalfFeeding"
  | "AnimalDiagnosis"
  | "AnimalHealthCase";

export type PendingMutation = {
  /** Stable client-side id (used as idempotency key for retries). */
  id: string;
  type: PendingMutationType;
  /** Original input passed to the mutation, serializable JSON. */
  payload: any;
  /** Free-text label rendered in the UI list ("Movement · BELLA"). */
  label: string;
  /** ISO timestamp of when the user submitted it. */
  createdAt: string;
  /** Retry counter. */
  attempts: number;
  /** Most recent failure message, if any. */
  lastError: string | null;
  /** ISO timestamp of last attempt. */
  lastAttemptAt: string | null;
};

let memoryQueue: PendingMutation[] | null = null;
const listeners = new Set<(q: PendingMutation[]) => void>();

const persist = async (queue: PendingMutation[]) => {
  memoryQueue = queue;
  await storage.setItem(STORAGE_KEYS.PENDING_QUEUE, JSON.stringify(queue));
  for (const fn of listeners) fn(queue);
};

export const loadQueue = async (): Promise<PendingMutation[]> => {
  if (memoryQueue) return memoryQueue;
  const raw = await storage.getItem(STORAGE_KEYS.PENDING_QUEUE);
  if (!raw) {
    memoryQueue = [];
    return memoryQueue;
  }
  try {
    const parsed = JSON.parse(raw);
    memoryQueue = Array.isArray(parsed) ? parsed : [];
  } catch {
    memoryQueue = [];
  }
  return memoryQueue;
};

export const subscribe = (fn: (q: PendingMutation[]) => void): (() => void) => {
  listeners.add(fn);
  // Push current value immediately.
  loadQueue().then((q) => fn(q));
  return () => listeners.delete(fn);
};

export const enqueue = async (
  entry: Omit<PendingMutation, "attempts" | "lastError" | "lastAttemptAt">,
): Promise<PendingMutation> => {
  const q = await loadQueue();
  const full: PendingMutation = {
    ...entry,
    attempts: 0,
    lastError: null,
    lastAttemptAt: null,
  };
  await persist([...q, full]);
  return full;
};

export const remove = async (id: string): Promise<void> => {
  const q = await loadQueue();
  await persist(q.filter((m) => m.id !== id));
};

export const markAttempt = async (
  id: string,
  error: string | null,
): Promise<void> => {
  const q = await loadQueue();
  const next = q.map((m) =>
    m.id === id
      ? {
          ...m,
          attempts: m.attempts + 1,
          lastError: error,
          lastAttemptAt: new Date().toISOString(),
        }
      : m,
  );
  await persist(next);
};

export const clear = async (): Promise<void> => {
  await persist([]);
};

export const newId = (): string =>
  `m_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
