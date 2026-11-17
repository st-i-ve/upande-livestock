import { AppState, AppStateStatus } from "react-native";

import { getClient } from "@/src/services/api";
import { queryClient } from "@/src/services/queryClient";
import { useSyncStore } from "@/src/sync/syncStore";

import { ServerAnimal, applySync } from "./animals";
import { clearDb, getMeta, setMeta } from "./index";

const ANIMALS_SINCE = "/api/method/upande_livestock.serverscripts.mobile.animals_since.animals_since";
const LAST_SYNC = "animals_server_time";
/** A foreground that follows another within this window does not sync again. */
const FOREGROUND_GAP_MS = 30_000;
/**
 * Syncs the server asks for (a change on the farm) come at most this often. A
 * bulk change on the server (an import, a big feeding run) sends change after
 * change; without a gap the phone synced back to back, the bar never left and
 * the lists kept reloading. What arrives in between is taken by the next one.
 */
const SERVER_SYNC_GAP_MS = 30_000;
/** A background sync shows the bar only when it brings in more animals than this. */
const QUIET_MAX = 25;

type Reply = {
  ok?: boolean;
  error?: string;
  server_time: string;
  animals: ServerAnimal[];
  removed: string[];
};

let inFlight: Promise<void> | null = null;
let lastRun = 0;

/**
 * Bring the local animals up to date. With no stored `server_time` (first run,
 * or after a logout) it takes the full set; otherwise only what changed since.
 * The server's own clock is what is stored and sent back, never the phone's, so
 * a wrong handset clock cannot skip an animal. Failures are swallowed on
 * purpose: offline, the phone carries on with what it has.
 */
export function syncAnimals(opts: { full?: boolean; quiet?: boolean } = {}): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    // The header dot and the syncing bar follow this through the sync store. A
    // quiet (background) sync shows them only once it has many animals to apply.
    const progress = useSyncStore.getState();
    if (!opts.quiet) progress.begin("animals");
    try {
      const since = opts.full ? null : await getMeta(LAST_SYNC);
      const client = await getClient();
      const res = await client.get(ANIMALS_SINCE, { params: since ? { since } : {} });
      const msg = res.data?.message as Reply | undefined;
      if (!msg || msg.error) throw new Error(msg?.error || "animals_since returned nothing");
      if (opts.quiet && msg.animals.length > QUIET_MAX) progress.begin("animals", msg.animals.length);
      if (msg.animals.length > 0) progress.progress("animals", 0, msg.animals.length);
      await applySync(msg.animals, msg.removed, !since, (n) => progress.progress("animals", n));
      await setMeta(LAST_SYNC, msg.server_time);
      progress.animalsDone(true);
      queryClient.invalidateQueries({ queryKey: ["animals"] });
      queryClient.invalidateQueries({ queryKey: ["animal"] });
    } catch (e) {
      console.warn("[sync] animals sync failed", e);
      progress.animalsDone(false, e instanceof Error ? e.message : String(e));
    } finally {
      progress.end("animals");
      lastRun = Date.now();
      inFlight = null;
    }
  })();
  return inFlight;
}

let queued: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * A sync after the server said something changed: in the background, and at
 * most once every SERVER_SYNC_GAP_MS. Too soon after the last, one sync is
 * scheduled for when the gap is up, and every change before then shares it.
 */
export function syncAnimalsSoon(): Promise<void> {
  if (queued) return queued;
  const wait = Math.max(0, lastRun + SERVER_SYNC_GAP_MS - Date.now());
  queued = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      timer = null;
      // One in flight may have read before the change: this one runs after it.
      void (inFlight ?? Promise.resolve())
        .then(() => {
          queued = null;
          return syncAnimals({ quiet: true });
        })
        .then(resolve, resolve);
    }, wait);
  });
  return queued;
}

/** Logout: drop the local herd so the next person to sign in starts empty. */
export async function clearLocalData(): Promise<void> {
  // A sync waiting for its gap would bring the last person's herd back.
  if (timer) clearTimeout(timer);
  timer = null;
  queued = null;
  await clearDb();
  queryClient.invalidateQueries({ queryKey: ["animals"] });
}

let stop: (() => void) | null = null;

/**
 * Delta sync whenever the app comes back to the foreground. Call once the user
 * is signed in; the returned function unsubscribes (sign-out).
 */
export function startAnimalSync(): () => void {
  if (stop) return stop;
  syncAnimals();
  const sub = AppState.addEventListener("change", (s: AppStateStatus) => {
    if (s === "active" && Date.now() - lastRun > FOREGROUND_GAP_MS) syncAnimals();
  });
  stop = () => {
    sub.remove();
    stop = null;
  };
  return stop;
}
