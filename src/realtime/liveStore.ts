import { create } from "zustand";

export type LiveStatus = "live" | "reconnecting" | "offline";

type LiveState = {
  status: LiveStatus;
  /** Bumped each time something new arrives from the farm; the toast listens. */
  updateSeq: number;
  setStatus: (s: LiveStatus) => void;
  noteUpdate: () => void;
};

export const useLiveStore = create<LiveState>((set) => ({
  status: "offline",
  updateSeq: 0,
  setStatus: (status) => set((s) => (s.status === status ? s : { status })),
  noteUpdate: () => set((s) => ({ updateSeq: s.updateSeq + 1 })),
}));
