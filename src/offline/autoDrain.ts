import NetInfo from "@react-native-community/netinfo";
import { AppState, AppStateStatus } from "react-native";

import { queryClient } from "@/src/services/queryClient";

import { drainQueue } from "./dispatcher";
import { loadQueue } from "./queue";

let started = false;
let runningDrain = false;

const drainIfWorth = async () => {
  if (runningDrain) return;
  const q = await loadQueue();
  if (q.length === 0) return;
  runningDrain = true;
  try {
    const res = await drainQueue();
    if (res.succeeded > 0) {
      // Anything successful invalidates the broad reads — the user's mock
      // suspense banners flip to "synced" automatically.
      queryClient.invalidateQueries({ queryKey: ["animals"] });
      queryClient.invalidateQueries({ queryKey: ["herds"] });
      queryClient.invalidateQueries({ queryKey: ["milk"] });
      queryClient.invalidateQueries({ queryKey: ["health-cases"] });
      queryClient.invalidateQueries({ queryKey: ["diagnoses"] });
      queryClient.invalidateQueries({ queryKey: ["disposals"] });
    }
  } finally {
    runningDrain = false;
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
    appStateSub.remove();
    started = false;
    unsubscribe = null;
  };
  return unsubscribe;
};

/** Manually trigger a drain (used by the Pending screen "Retry now" button). */
export const drainNow = drainIfWorth;
