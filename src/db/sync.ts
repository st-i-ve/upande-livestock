import { AppState, AppStateStatus } from "react-native";

import { getClient } from "@/src/services/api";
import { queryClient } from "@/src/services/queryClient";

import { ServerAnimal, applySync } from "./animals";
import { clearDb, getMeta, setMeta } from "./index";

const ANIMALS_SINCE = "/api/method/upande_livestock.serverscripts.mobile.animals_since.animals_since";
const LAST_SYNC = "animals_server_time";
/** A foreground that follows another within this window does not sync again. */
const FOREGROUND_GAP_MS = 30_000;

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
export function syncAnimals(opts: { full?: boolean } = {}): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const since = opts.full ? null : await getMeta(LAST_SYNC);
      const client = await getClient();
      const res = await client.get(ANIMALS_SINCE, { params: since ? { since } : {} });
      const msg = res.data?.message as Reply | undefined;
      if (!msg || msg.error) throw new Error(msg?.error || "animals_since returned nothing");
      await applySync(msg.animals, msg.removed, !since);
      await setMeta(LAST_SYNC, msg.server_time);
      queryClient.invalidateQueries({ queryKey: ["animals"] });
      queryClient.invalidateQueries({ queryKey: ["animal"] });
    } catch (e) {
      console.warn("[sync] animals sync failed", e);
    } finally {
      lastRun = Date.now();
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Logout: drop the local herd so the next person to sign in starts empty. */
export async function clearLocalData(): Promise<void> {
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
