import NetInfo from "@react-native-community/netinfo";
import { Alert, AppState, AppStateStatus } from "react-native";

import { stockOutcomeText } from "@/src/frappe/eventItems";

import { syncAnimalsSoon } from "@/src/db/sync";
import { useSyncStore } from "@/src/sync/syncStore";
import { queryClient } from "@/src/services/queryClient";

import { drainQueue } from "./dispatcher";
import { loadQueue } from "./queue";

let started = false;
let tick: ReturnType<typeof setInterval> | null = null;
let runningDrain = false;
let again = false;

/** The timed drain's gap: a pass that respects each item's backoff. */
const TICK_MS = 30_000;

const drainIfWorth = async (force = true) => {
  if (runningDrain) {
    // Something was saved while a pass was running: go round once more.
    again = true;
    return;
  }
  const q = await loadQueue();
  if (q.length === 0) return;
  runningDrain = true;
  try {
    // The sync bar shows the records going up (it only appears if that takes a moment).
    const progress = useSyncStore.getState();
    const waiting = q.filter((i) => i.status !== "attention").length;
    let done = 0;
    if (waiting > 0) progress.begin("records", waiting);
    let res: Awaited<ReturnType<typeof drainQueue>>;
    try {
      res = await drainQueue({ force, onStep: () => progress.progress("records", ++done) });
    } finally {
      progress.end("records");
    }
    // A record taken offline whose stock issue the server left as a draft: say so,
    // the sync must not swallow it.
    const drafts = stockOutcomeText(res.replies);
    if (drafts) Alert.alert("Synced: stock issue is a draft", drafts);
    if (res.succeeded > 0) {
      // Anything successful invalidates the broad reads — the user's mock
      // suspense banners flip to "synced" automatically.
      // What the server now holds replaces the phone's optimistic guess.
      void syncAnimalsSoon();
      queryClient.invalidateQueries({ queryKey: ["animals"] });
      queryClient.invalidateQueries({ queryKey: ["animal"] });
      queryClient.invalidateQueries({ queryKey: ["herds"] });
      queryClient.invalidateQueries({ queryKey: ["milk"] });
      queryClient.invalidateQueries({ queryKey: ["health-cases"] });
      queryClient.invalidateQueries({ queryKey: ["diagnoses"] });
      queryClient.invalidateQueries({ queryKey: ["disposals"] });
      queryClient.invalidateQueries({ queryKey: ["quality-tests"] });
      queryClient.invalidateQueries({ queryKey: ["feedDay"] });
      queryClient.invalidateQueries({ queryKey: ["feedReport"] });
      queryClient.invalidateQueries({ queryKey: ["feedDayStatus"] });
      queryClient.invalidateQueries({ queryKey: ["herdFeedInfo"] });
    }
  } finally {
    runningDrain = false;
    if (again) {
      again = false;
      void drainIfWorth(false);
    }
  }
};

/**
 * Subscribes to network + app-foreground events and drains the pending
 * queue whenever a sync opportunity appears. Idempotent — calling more
 * than once is harmless; subsequent calls return the previous unsubscribe.
 */
let unsubscribe: (() => void) | null = null;
export const startAutoDrain = (): (() => void) => {
  if (started && unsubscribe) return unsubscribe;
  started = true;

  // Initial attempt — in case there's a pending queue from a previous session
  // and the device is already online.
  drainIfWorth();
  // The sync tick: items waiting out a backoff are tried again when it is up.
  tick = setInterval(() => void drainIfWorth(false), TICK_MS);

  const unsubNet = NetInfo.addEventListener((state) => {
    const online = state.isInternetReachable ?? state.isConnected;
    if (online) drainIfWorth();
  });

  const onAppState = (next: AppStateStatus) => {
    if (next === "active") drainIfWorth();
  };
  const appStateSub = AppState.addEventListener("change", onAppState);

  unsubscribe = () => {
    unsubNet();
    if (tick) clearInterval(tick);
    tick = null;
    appStateSub.remove();
    started = false;
    unsubscribe = null;
  };
  return unsubscribe;
};

/** Manually trigger a drain (used by the Pending screen "Retry now" button). */
export const drainNow = () => drainIfWorth(true);

/** A recording was just saved: try to send it at once, in the background. */
export const kickDrain = () => {
  void drainIfWorth(false);
};
