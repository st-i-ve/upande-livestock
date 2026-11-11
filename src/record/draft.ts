import { create } from "zustand";

/**
 * A record form the user walked away from by switching tabs, kept so a
 * "Continue recording" button can bring it back. One at a time: the latest.
 *
 * While the form is open its state is mirrored here as a LIVE draft
 * (`pending: false`). When its tab loses focus the draft turns PENDING; the tab
 * then pops to its top and the form unmounts, but the pending draft stays.
 * A live draft whose form unmounts any other way (back, save) is dropped.
 * Memory only: a restart of the app forgets it.
 */
export type RecordDraft = {
  /** The record screen's route and params, e.g. `/(tabs)/animals/act/weight?animal=A011`. */
  key: string;
  /** Where to go to continue it (the same string as the key). */
  href: string;
  /** The event's name, for the button: "Weight". */
  title: string;
  /** The form's state, as its screen handed it to useRecordDraft. */
  state: unknown;
  pending: boolean;
};

type DraftStore = {
  draft: RecordDraft | null;
  /** Mirror a form's state as the draft (replacing any other). Its own pending flag is kept:
   *  a form re-rendering after its tab lost focus must not turn it live again. */
  save: (d: Omit<RecordDraft, "pending">) => void;
  /** Its tab lost focus: a live draft becomes pending. */
  markPending: () => void;
  /** The form is back on screen: a pending draft for it is live again. */
  resume: (key: string) => void;
  /** Drop the draft — any, or only the one for `key`. */
  clear: (key?: string) => void;
  /** Drop the draft for `key` only while it is live (its form unmounted without a tab switch). */
  dropLive: (key: string) => void;
};

export const useRecordDrafts = create<DraftStore>((set, get) => ({
  draft: null,
  save: (d) => {
    const prev = get().draft;
    set({ draft: { ...d, pending: prev?.key === d.key ? prev.pending : false } });
  },
  markPending: () => {
    const d = get().draft;
    if (d && !d.pending) set({ draft: { ...d, pending: true } });
  },
  resume: (key) => {
    const d = get().draft;
    if (d && d.key === key && d.pending) set({ draft: { ...d, pending: false } });
  },
  clear: (key) => {
    const d = get().draft;
    if (d && (key === undefined || d.key === key)) set({ draft: null });
  },
  dropLive: (key) => {
    const d = get().draft;
    if (d && d.key === key && !d.pending) set({ draft: null });
  },
}));

type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

/**
 * The href that reopens a record screen: its segments with the dynamic ones
 * (`[type]`) filled from the params, and the remaining params as a sorted query.
 * Groups are kept (`/(tabs)/record/...`) because the cattle and shoats apps
 * both have a `/record`.
 */
export function draftHref(segments: readonly string[], params: Params): string {
  const used = new Set<string>();
  const path = segments
    .filter((s) => s && s !== "index")
    .map((s) => {
      const m = /^\[(?:\.\.\.)?(.+)\]$/.exec(s);
      if (!m) return s;
      used.add(m[1]);
      return encodeURIComponent(one(params[m[1]]) ?? "");
    })
    .join("/");
  const query = Object.keys(params)
    .filter((k) => !used.has(k) && one(params[k]) !== undefined && one(params[k]) !== "")
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(one(params[k])!)}`)
    .join("&");
  return `/${path}${query ? `?${query}` : ""}`;
}

/**
 * Has the user put anything into the form? Blank: null, undefined, false,
 * whitespace, an empty array / Set / Map / object, or an object whose values are
 * all blank. The animal a quick action opened the form for (`presetId`) is not
 * input: `[preset]` or `preset` alone counts as blank. Numbers count as input.
 */
export function hasInput(value: unknown, presetId?: string | null): boolean {
  if (value === null || value === undefined || value === false) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return true;
  if (typeof value === "boolean") return value;
  if (value instanceof Set || value instanceof Map) return value.size > 0;
  if (value instanceof Date) return true;
  if (Array.isArray(value)) {
    if (presetId && value.length === 1 && isAnimal(value[0], presetId)) return false;
    return value.some((v) => hasInput(v, presetId));
  }
  if (typeof value === "object") {
    if (presetId && isAnimal(value, presetId)) return false;
    // An animal (or any record with an id) picked by the user is input.
    if ("id" in (value as object) && typeof (value as { id: unknown }).id === "string") return true;
    // A row's own `id` (a counter) is not input; its fields are.
    return Object.entries(value as object).some(([k, v]) => k !== "id" && hasInput(v, presetId));
  }
  return true;
}

const isAnimal = (v: unknown, id: string) =>
  !!v && typeof v === "object" && (v as { id?: unknown }).id === id;

/** A tab's top screen: `(tabs)/animals`, `(shoats)/profile` — group plus one segment. */
export const isTabRoot = (segments: readonly string[]): boolean =>
  segments.filter((s) => s && s !== "index").length <= 2;
