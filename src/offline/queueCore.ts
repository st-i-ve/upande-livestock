/**
 * The offline queue, with no React Native in it.
 *
 * Every recording the phone makes is written here FIRST, under a `client_ref`
 * (the item's id, a uuid), and sent from here when there is signal. The server
 * keeps the answer to each client_ref, so a send whose reply was lost can be
 * sent again without filing the thing twice.
 *
 * The rules, all in `drain`:
 *  - oldest first, but only per animal: an item waits behind an earlier item
 *    that shares one of its `keys` (a service before its PD), and never behind
 *    one for another animal;
 *  - a dead network stops the pass and costs the item nothing;
 *  - a refusal by the server (a 4xx, or its `{error}` answer) is not sent again:
 *    the item goes to "needs attention" for the person to edit, retry or discard;
 *  - a server fault (5xx, timeout) is sent again with backoff, and goes to
 *    "needs attention" after MAX_RETRIES.
 * Storage, clock and the sender are handed in, so the tests drive all of it.
 */

export type ItemStatus = "pending" | "attention";

export type QueueItem = {
  /** The client_ref: a uuid made once, when the recording is saved. */
  id: string;
  type: string;
  /** Serializable JSON of what the sender needs. */
  payload: any;
  /** Shown in lists: "Service · BELLA". */
  label: string;
  createdAt: string;
  attempts: number;
  lastError: string | null;
  lastAttemptAt: string | null;
  /** Animals (or herds) this recording is about; items sharing a key keep their order. */
  keys?: string[];
  status?: ItemStatus;
  /** Epoch ms before which the timed drain leaves it alone. */
  nextAttemptAt?: number | null;
  /** Failed sends that never reached the server (not counted as attempts). */
  misses?: number;
};

export type Kv = {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
};

export type Verdict = "network" | "rejected" | "retry";

export const MAX_RETRIES = 6;

export const backoffMs = (n: number): number => Math.min(30 * 60_000, 5_000 * 2 ** Math.max(0, n - 1));

/** A v4 uuid. Uses the platform's when it has one. */
export const makeUuid = (): string => {
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const h = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += "-";
    else if (i === 14) out += "4";
    else {
      const r = Math.floor(Math.random() * 16);
      out += h[i === 19 ? (r & 3) | 8 : r];
    }
  }
  return out;
};

/** What a failed send means. See the rules above. */
export const classify = (err: unknown): Verdict => {
  const e = err as any;
  if (!e) return "retry";
  // The server answered {error} in a 200: it landed, and it said no.
  if (e.isServerRejection) return "rejected";
  if (!e.response) return "network";
  if (e.code === "ECONNABORTED" || e.code === "ERR_NETWORK") return "network";
  const status = Number(e.response?.status) || 0;
  // Signed out: nothing is wrong with the recording; wait for a login.
  if (status === 401) return "network";
  if (status === 408 || status === 425 || status === 429 || status >= 500) return "retry";
  return "rejected";
};

export type DrainResult = {
  replies: any[];
  succeeded: number;
  remaining: number;
  attention: number;
  errors: { id: string; message: string }[];
};

export type Handler = (payload: any, item: QueueItem) => Promise<any>;

export type QueueDeps = {
  kv: Kv;
  now?: () => number;
  /** Called with items that left the queue (sent or discarded), to clean up their files. */
  onGone?: (items: QueueItem[]) => void;
  messageOf?: (err: unknown, item: QueueItem) => string;
};

export const isAttention = (i: QueueItem) => i.status === "attention";

export function createQueue(deps: QueueDeps) {
  const now = deps.now ?? (() => Date.now());
  let mem: QueueItem[] | null = null;
  let draining = false;
  const listeners = new Set<(q: QueueItem[]) => void>();

  const persist = async (q: QueueItem[]) => {
    mem = q;
    await deps.kv.set(JSON.stringify(q));
    for (const fn of listeners) fn(q);
  };

  const load = async (): Promise<QueueItem[]> => {
    if (mem) return mem;
    const raw = await deps.kv.get();
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      mem = Array.isArray(parsed) ? parsed : [];
    } catch {
      mem = [];
    }
    return mem;
  };

  const patch = async (id: string, fn: (i: QueueItem) => QueueItem) => {
    const q = await load();
    await persist(q.map((i) => (i.id === id ? fn(i) : i)));
  };

  /** Save a recording. The same id twice is the same recording: it is kept once. */
  const enqueue = async (
    entry: Omit<QueueItem, "attempts" | "lastError" | "lastAttemptAt" | "createdAt"> & { createdAt?: string },
  ): Promise<QueueItem> => {
    const q = await load();
    const have = q.find((i) => i.id === entry.id);
    if (have) return have;
    const full: QueueItem = {
      status: "pending",
      ...entry,
      createdAt: entry.createdAt ?? new Date(now()).toISOString(),
      attempts: 0,
      lastError: null,
      lastAttemptAt: null,
    };
    await persist([...q, full]);
    return full;
  };

  const remove = async (id: string) => {
    const q = await load();
    const gone = q.filter((i) => i.id === id);
    await persist(q.filter((i) => i.id !== id));
    if (gone.length) deps.onGone?.(gone);
  };

  const clear = async () => {
    const q = await load();
    await persist([]);
    deps.onGone?.(q);
  };

  /** Put an item that needs attention back in line, to be sent at the next drain. */
  const retry = (id: string) =>
    patch(id, (i) => ({ ...i, status: "pending", attempts: 0, misses: 0, nextAttemptAt: null }));

  /** Replace what will be sent (the person corrected it) and put it back in line. */
  const edit = (id: string, payload: any, label?: string) =>
    patch(id, (i) => ({
      ...i,
      payload,
      label: label ?? i.label,
      status: "pending",
      attempts: 0,
      misses: 0,
      nextAttemptAt: null,
    }));

  const subscribe = (fn: (q: QueueItem[]) => void) => {
    listeners.add(fn);
    void load().then(fn);
    return () => {
      listeners.delete(fn);
    };
  };

  const drain = async (
    handlers: Record<string, Handler>,
    opts: { force?: boolean; onStep?: () => void } = {},
  ): Promise<DrainResult> => {
    const empty = async (): Promise<DrainResult> => {
      const q = await load();
      return { replies: [], succeeded: 0, remaining: q.length, attention: q.filter(isAttention).length, errors: [] };
    };
    if (draining) return empty();
    draining = true;
    const replies: any[] = [];
    const errors: DrainResult["errors"] = [];
    let succeeded = 0;
    try {
      const blocked = new Set<string>();
      const hold = (i: QueueItem) => (i.keys ?? []).forEach((k) => blocked.add(k));
      for (const item of [...(await load())]) {
        if (isAttention(item)) {
          hold(item);
          continue;
        }
        if ((item.keys ?? []).some((k) => blocked.has(k))) continue;
        if (!opts.force && item.nextAttemptAt && item.nextAttemptAt > now()) {
          hold(item);
          continue;
        }
        const handler = handlers[item.type];
        try {
          if (!handler) throw Object.assign(new Error(`No sender for ${item.type}.`), { isServerRejection: true });
          const reply = await handler(item.payload, item);
          replies.push(reply);
          await remove(item.id);
          succeeded += 1;
          opts.onStep?.();
        } catch (err) {
          opts.onStep?.();
          const verdict = classify(err);
          const message = deps.messageOf ? deps.messageOf(err, item) : String((err as any)?.message ?? err);
          const stamp = new Date(now()).toISOString();
          errors.push({ id: item.id, message });
          if (verdict === "network") {
            const misses = (item.misses ?? 0) + 1;
            await patch(item.id, (i) => ({
              ...i,
              lastError: message,
              lastAttemptAt: stamp,
              misses,
              nextAttemptAt: now() + backoffMs(misses),
            }));
            break;
          }
          const attempts = item.attempts + 1;
          const giveUp = verdict === "rejected" || attempts >= MAX_RETRIES;
          await patch(item.id, (i) => ({
            ...i,
            attempts,
            lastError: message,
            lastAttemptAt: stamp,
            status: giveUp ? "attention" : "pending",
            nextAttemptAt: giveUp ? null : now() + backoffMs(attempts),
          }));
          hold(item);
        }
      }
      const q = await load();
      return { replies, succeeded, remaining: q.length, attention: q.filter(isAttention).length, errors };
    } finally {
      draining = false;
    }
  };

  return { load, subscribe, enqueue, remove, clear, retry, edit, drain, reset: () => { mem = null; } };
}

export type OfflineQueue = ReturnType<typeof createQueue>;

/** The groups a sync sheet lists: waiting records by kind, then needs attention. */
export type QueueGroup = { key: string; title: string; items: QueueItem[]; attention: boolean };

const TITLES: Record<string, string> = {
  MilkRecording: "Milk recordings",
  MilkQualityTest: "Milk quality sheets",
  AnimalEvent: "Animal events",
  AnimalDiagnosis: "Check-ups",
  Treatment: "Treatments",
  Weights: "Weights",
  Feeding: "Feeding",
  FeedDay: "Feeding day sheets",
  HerdMoves: "Herd moves",
  AnimalPhoto: "Photos",
  AnimalDisposal: "Disposals",
  MilkQuality: "Milk quality",
};

const ORDER = [
  "MilkRecording", "AnimalEvent", "HerdMoves", "AnimalDiagnosis", "Treatment", "Weights",
  "Feeding", "FeedDay", "MilkQualityTest", "MilkQuality", "AnimalDisposal", "AnimalPhoto",
];

/** Waiting records grouped by kind (photos last, as the sync bar orders its parts), and the
 *  ones that need attention in a group of their own on top. */
export const groupQueue = (items: QueueItem[]): QueueGroup[] => {
  const out: QueueGroup[] = [];
  const attn = items.filter(isAttention);
  if (attn.length) out.push({ key: "attention", title: "Needs attention", items: attn, attention: true });
  const rank = (t: string) => (ORDER.indexOf(t) === -1 ? ORDER.length : ORDER.indexOf(t));
  const types = [...new Set(items.filter((i) => !isAttention(i)).map((i) => i.type))].sort((a, b) => rank(a) - rank(b));
  for (const t of types) {
    out.push({
      key: t,
      title: TITLES[t] ?? t,
      items: items.filter((i) => !isAttention(i) && i.type === t),
      attention: false,
    });
  }
  return out;
};
