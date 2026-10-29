import { AppState, AppStateStatus } from "react-native";
import { io, Socket } from "socket.io-client";

import { syncAnimals, syncAnimalsSoon } from "@/src/db/sync";
import { getClient } from "@/src/services/api";
import { queryClient } from "@/src/services/queryClient";
import { STORAGE_KEYS, storage } from "@/src/services/storage";

import { useLiveStore } from "./liveStore";

/**
 * Live updates. The server broadcasts `livestock_changed` (ids only, never
 * data) whenever an animal, event, stock entry, health case, vet or
 * the settings change. The phone hears it, runs the delta sync and refreshes
 * the screens that show what changed, so another person's work appears within
 * seconds without a pull-to-refresh.
 *
 * Auth: Frappe's socket server authenticates the handshake by the `sid`
 * session cookie, so we send the same Cookie header the REST calls use, over
 * the websocket transport (React Native lets a WebSocket carry headers).
 * Frappe puts each site in its own namespace named after the site, which the
 * server tells us (`realtime_info`).
 *
 * Battery: connected only while signed in AND in the foreground.
 * Fallback: whenever the socket is not live, the delta sync is polled every
 * 60 s while foregrounded. Both paths share syncAnimals' one in-flight guard.
 */

const EVENT = "livestock_changed";
const REALTIME_INFO = "/api/method/upande_livestock.serverscripts.mobile.realtime_info.realtime_info";
const DEBOUNCE_MS = 1000;
const POLL_MS = 60_000;
/** Failed attempts in a row before the dot says offline rather than reconnecting. */
const OFFLINE_AFTER = 3;

type Change = {
  kind?: "animal" | "event" | "stock" | "settings" | "health" | "vet";
  names?: string[];
  animals?: string[];
  truncated?: boolean;
};

const invalidate = (...keys: string[]) => {
  for (const k of keys) queryClient.invalidateQueries({ queryKey: [k] });
};

const STOCK_KEYS = ["health-options", "livestock-stock", "batch-plan"];
const SETTINGS_KEYS = ["livestock-settings", "posting-day", "vets", "health-options", "eligibility"];
const ANIMAL_KEYS = ["animal", "animal-profile", "animal-events", "animal-gallery", "animal-standing"];
const LIST_KEYS = ["herds", "herd", "health-cases", "diagnoses", "disposals"];

let socket: Socket | null = null;
let active = AppState.currentState === "active";
let failures = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let debounce: ReturnType<typeof setTimeout> | null = null;
let wasLive = false;
let stopped = true;

// What arrived during the debounce window, folded into one refresh.
let pend = { sync: false, all: false, animals: new Set<string>(), stock: false, settings: false, lists: false };

function refreshNow() {
  debounce = null;
  const p = pend;
  pend = { sync: false, all: false, animals: new Set(), stock: false, settings: false, lists: false };
  if (p.sync) void syncAnimalsSoon();
  if (p.all) invalidate(...ANIMAL_KEYS);
  else for (const id of p.animals) for (const k of ANIMAL_KEYS) queryClient.invalidateQueries({ queryKey: [k, id] });
  if (p.lists) invalidate(...LIST_KEYS);
  if (p.stock) invalidate(...STOCK_KEYS);
  if (p.settings) invalidate(...SETTINGS_KEYS);
}

function onChange(msg: Change) {
  switch (msg?.kind) {
    case "animal":
    case "event":
    case "health":
      pend.sync = true;
      pend.lists = true;
      if (msg.truncated || !msg.animals?.length) pend.all = pend.all || !!msg.truncated;
      for (const a of msg.animals ?? []) pend.animals.add(a);
      useLiveStore.getState().noteUpdate();
      break;
    case "stock":
      pend.stock = true;
      break;
    case "settings":
    case "vet":
      pend.settings = true;
      break;
    default:
      // A kind this build does not know: refresh everything cheap.
      pend.sync = true;
      pend.stock = true;
      pend.settings = true;
  }
  if (!debounce) debounce = setTimeout(refreshNow, DEBOUNCE_MS);
}

/** After a gap in the connection events were missed: catch up on everything. */
function catchUp() {
  void syncAnimalsSoon();
  invalidate(...ANIMAL_KEYS, ...LIST_KEYS, ...STOCK_KEYS, ...SETTINGS_KEYS);
}

function setPolling(on: boolean) {
  if (on && !pollTimer) {
    pollTimer = setInterval(() => void syncAnimals(), POLL_MS);
  } else if (!on && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function markDown() {
  failures += 1;
  useLiveStore.getState().setStatus(failures >= OFFLINE_AFTER ? "offline" : "reconnecting");
  setPolling(active && !stopped);
}

function scheduleRetry() {
  if (retryTimer || stopped || !active) return;
  const delay = Math.min(2000 * 2 ** Math.max(0, failures - 1), 60_000);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void connect();
  }, delay);
}

async function connect() {
  if (socket || stopped || !active) return;
  try {
    const [base, cookie, sid] = await Promise.all([
      storage.getItem(STORAGE_KEYS.INSTANCE_URL),
      storage.getItem(STORAGE_KEYS.COOKIE),
      storage.getItem(STORAGE_KEYS.SID),
    ]);
    if (!base || (!cookie && !sid)) return;
    const client = await getClient();
    const res = await client.get(REALTIME_INFO);
    const namespace = res.data?.message?.namespace as string | undefined;
    if (!namespace) throw new Error("realtime_info gave no namespace");
    // The app may have gone to the background, or signed out, while asking.
    if (socket || stopped || !active) return;

    const url = base.trim().replace(/\/+$/, "");
    const s = io(`${url}/${namespace}`, {
      path: "/socket.io",
      transports: ["websocket"],
      extraHeaders: { Cookie: cookie || `sid=${sid}` },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30_000,
      randomizationFactor: 0.5,
      timeout: 10_000,
    });
    socket = s;

    s.on("connect", () => {
      failures = 0;
      useLiveStore.getState().setStatus("live");
      setPolling(false);
      // Anything between the last live moment and now was never heard.
      if (wasLive) catchUp();
      wasLive = true;
    });
    s.on(EVENT, onChange);
    s.on("connect_error", () => markDown());
    s.on("disconnect", (reason) => {
      markDown();
      // The server hung up on us (restart, session end): socket.io will not
      // retry that one by itself.
      if (reason === "io server disconnect" && socket === s) setTimeout(() => s.connect(), 2000);
    });
  } catch (e) {
    console.warn("[realtime] could not connect", e);
    markDown();
    scheduleRetry();
  }
}

function disconnect() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  setPolling(false);
  useLiveStore.getState().setStatus("offline");
}

/**
 * Start the live connection for a signed-in user; the returned function stops
 * it (sign-out). Safe to call again: a second call returns a no-op stopper.
 */
export function startRealtime(): () => void {
  if (!stopped) return () => {};
  stopped = false;
  failures = 0;
  wasLive = false;
  active = AppState.currentState === "active";
  if (active) void connect();
  const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
    const nowActive = state === "active";
    if (nowActive === active) return;
    active = nowActive;
    if (active) {
      failures = 0;
      // Whatever happened while the socket was closed is caught up on connect.
      wasLive = true;
      void connect();
    } else {
      disconnect();
    }
  });
  return () => {
    stopped = true;
    sub.remove();
    if (debounce) clearTimeout(debounce);
    debounce = null;
    disconnect();
  };
}
