import { create } from "zustand";

import type { SyncKind, SyncPart } from "./syncStatus";

/**
 * What is syncing right now, fed by the sync functions themselves (the animals
 * delta sync in src/db/sync.ts, photo uploads in src/frappe/files.ts). The
 * header dot and the syncing bar read it; nothing here talks to the server.
 */
type SyncState = {
  parts: Partial<Record<SyncKind, SyncPart>>;
  /** Epoch ms of the last animals sync the farm answered. */
  animalsSyncedAt: number | null;
  /** Why the last animals sync failed, until the next one succeeds. */
  animalsError: string | null;
  /** A part starts, or its size becomes known. */
  begin: (kind: SyncKind, total?: number | null) => void;
  progress: (kind: SyncKind, done: number, total?: number | null) => void;
  /** One more of a kind is waiting (another photo goes up while one is). */
  add: (kind: SyncKind, n?: number) => void;
  /** One of a kind finished; the part goes when all of it has. */
  tick: (kind: SyncKind, n?: number) => void;
  end: (kind: SyncKind) => void;
  animalsDone: (ok: boolean, error?: string) => void;
};

const without = (parts: SyncState["parts"], kind: SyncKind) => {
  const next = { ...parts };
  delete next[kind];
  return next;
};

export const useSyncStore = create<SyncState>((set) => ({
  parts: {},
  animalsSyncedAt: null,
  animalsError: null,
  begin: (kind, total = null) =>
    set((s) => ({ parts: { ...s.parts, [kind]: { kind, done: 0, total } } })),
  progress: (kind, done, total) =>
    set((s) => {
      const p = s.parts[kind];
      if (!p) return s;
      return { parts: { ...s.parts, [kind]: { ...p, done, total: total === undefined ? p.total : total } } };
    }),
  add: (kind, n = 1) =>
    set((s) => {
      const p = s.parts[kind] ?? { kind, done: 0, total: 0 };
      return { parts: { ...s.parts, [kind]: { ...p, total: (p.total ?? 0) + n } } };
    }),
  tick: (kind, n = 1) =>
    set((s) => {
      const p = s.parts[kind];
      if (!p) return s;
      const done = p.done + n;
      if (p.total !== null && done >= p.total) return { parts: without(s.parts, kind) };
      return { parts: { ...s.parts, [kind]: { ...p, done } } };
    }),
  end: (kind) => set((s) => (s.parts[kind] ? { parts: without(s.parts, kind) } : s)),
  animalsDone: (ok, error) =>
    set(ok ? { animalsSyncedAt: Date.now(), animalsError: null } : { animalsError: error ?? "Sync failed" }),
}));

/** The parts in a stable list, for the bar and the dot. */
export const partsOf = (parts: SyncState["parts"]): SyncPart[] =>
  Object.values(parts).filter((p): p is SyncPart => !!p);
