/**
 * What the header dot and the syncing bar say. Pure: the network (NetInfo),
 * the live connection (src/realtime) and the sync store hand their state in,
 * this decides the dot's colour and words and the bar's text and fill.
 *
 * The dot is the SCP app's status light: green and glowing when the phone is
 * online and hearing the farm live, amber while something syncs (glowing) or
 * while the live connection is still coming up (steady), red when the phone
 * has no network, grey before anything is known.
 */

import type { LiveStatus } from "@/src/realtime/liveStore";

export type DotState = "live" | "syncing" | "connecting" | "offline" | "unknown";

export type DotInput = {
  /** NetInfo: true reachable, false no network, null not known yet. */
  online: boolean | null;
  live: LiveStatus;
  syncing: boolean;
};

export const dotState = ({ online, live, syncing }: DotInput): DotState => {
  if (online === false) return "offline";
  if (syncing) return "syncing";
  if (live === "live") return "live";
  if (online === null) return "unknown";
  return "connecting";
};

/** The SCP status-light colours (its update dot is #2ECC71). */
export const DOT_COLOR: Record<DotState, string> = {
  live: "#2ECC71",
  syncing: "#F5A623",
  connecting: "#F5A623",
  offline: "#E74C3C",
  unknown: "#9CA3AF",
};

/** Only a phone that is doing well, or busy, glows. */
export const DOT_PULSES: Record<DotState, boolean> = {
  live: true,
  syncing: true,
  connecting: false,
  offline: false,
  unknown: false,
};

export const DOT_TITLE: Record<DotState, string> = {
  live: "Online · live",
  syncing: "Online · syncing",
  connecting: "Online · connecting",
  offline: "Offline",
  unknown: "Checking connection",
};

export const DOT_BODY: Record<DotState, string> = {
  live: "Connected to the farm. Work other people record appears here within seconds.",
  syncing: "Connected. The phone is bringing its animals up to date with the farm.",
  connecting:
    "The phone has a network but the live link to the farm is not up yet. Changes are checked every minute until it is.",
  offline:
    "No network. You can look at the animals already on this phone; recording needs a connection.",
  unknown: "Finding out whether the phone has a network.",
};

// ---- the syncing bar ----

export type SyncKind = "animals" | "photos";

export type SyncPart = {
  kind: SyncKind;
  done: number;
  /** null while not known yet (the farm has not answered). */
  total: number | null;
};

const ORDER: SyncKind[] = ["animals", "photos"];

const NOUN: Record<SyncKind, [string, string]> = {
  animals: ["animal", "animals"],
  photos: ["photo", "photos"],
};

const noun = (kind: SyncKind, n: number) => NOUN[kind][n === 1 ? 0 : 1];

const sorted = (parts: SyncPart[]) =>
  [...parts].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));

/** "Syncing animals…", "Syncing 120 of 480 animals", "Uploading photo 1 of 2",
 *  or for several at once "Syncing 3 of 7 items · animals · photos". */
export const syncText = (parts: SyncPart[]): string => {
  if (parts.length === 0) return "";
  const list = sorted(parts);
  if (list.length === 1) {
    const p = list[0];
    if (p.kind === "photos") {
      const total = Math.max(1, p.total ?? 1);
      return total === 1
        ? "Uploading photo"
        : `Uploading ${noun("photos", 1)} ${Math.min(p.done + 1, total)} of ${total}`;
    }
    if (p.total === null) return `Syncing ${noun(p.kind, 2)}…`;
    return `Syncing ${Math.min(p.done, p.total)} of ${p.total} ${noun(p.kind, p.total)}`;
  }
  const kinds = list.map((p) => noun(p.kind, 2)).join(" · ");
  const known = list.filter((p) => p.total !== null);
  // A part whose size is not known yet would make the count a lie: name them only.
  if (known.length < list.length) return `Syncing ${kinds}`;
  const done = known.reduce((n, p) => n + Math.min(p.done, p.total ?? 0), 0);
  const total = known.reduce((n, p) => n + (p.total ?? 0), 0);
  return `Syncing ${done} of ${total} items · ${kinds}`;
};

/** How full the bar is, 0..1; null while no size is known or nothing is done yet (it slides). */
export const syncFraction = (parts: SyncPart[]): number | null => {
  const known = parts.filter((p) => p.total !== null && p.total > 0);
  if (known.length === 0 || known.length < parts.length) return null;
  const done = known.reduce((n, p) => n + Math.min(p.done, p.total ?? 0), 0);
  const total = known.reduce((n, p) => n + (p.total ?? 0), 0);
  // Nothing finished yet (one photo going up, the first rows not written): slide.
  return total > 0 && done > 0 ? Math.min(1, done / total) : null;
};

/** "Animals synced just now", "… 5 min ago", "… 2 h ago", or "Animals not synced yet". */
export const lastSyncedText = (ms: number | null, now = Date.now()): string => {
  if (ms === null) return "Animals not synced yet";
  const diff = Math.max(0, now - ms);
  if (diff < 60_000) return "Animals synced just now";
  if (diff < 3_600_000) return `Animals synced ${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `Animals synced ${Math.floor(diff / 3_600_000)} h ago`;
  const d = new Date(ms);
  return `Animals synced ${d.getDate()}/${d.getMonth() + 1}`;
};

// ---- the quiet summary in the bar's place when nothing is syncing ----

/** "just now", "1 min ago", "12 min ago", "3 h ago", or the day: "9/11". */
export const agoText = (ms: number, now = Date.now()): string => {
  const diff = Math.max(0, now - ms);
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  const d = new Date(ms);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

export type SummaryInput = {
  /** What the phone holds: cattle as animals, shoats as herds and head. */
  what: { animals: number | null } | { herds: number; head: number } | null;
  /** When it was last brought up to date (epoch ms), null never. */
  syncedAt: number | null;
  now: number;
  /** The last try failed (and none has succeeded since). */
  failed?: boolean;
  offline?: boolean;
  /** Records kept for Continue recording. */
  waiting?: number;
};

/**
 * The line the sync bar's strip shows while nothing syncs:
 * "All synced · 475 animals · 2 min ago · 1 record waiting",
 * "All synced · 5 herds · 420 head · just now", "Offline · 475 animals · 3 h ago".
 */
export const summaryText = ({ what, syncedAt, now, failed, offline, waiting = 0 }: SummaryInput): string => {
  const head = offline
    ? "Offline"
    : syncedAt === null
      ? failed ? "Not synced" : "Not synced yet"
      : failed ? "Last sync failed" : "All synced";
  const parts = [head];
  if (what && "animals" in what) {
    if (what.animals !== null) parts.push(plural(what.animals, "animal", "animals"));
  } else if (what) {
    parts.push(plural(what.herds, "herd", "herds"), `${what.head.toLocaleString("en-US")} head`);
  }
  if (syncedAt !== null) parts.push(agoText(syncedAt, now));
  if (waiting > 0) parts.push(plural(waiting, "record waiting", "records waiting"));
  return parts.join(" · ");
};
