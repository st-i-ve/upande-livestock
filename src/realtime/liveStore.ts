import { create } from "zustand";

/** The live link to the farm; the header dot (components/OnlineDot) shows it. */

export type LiveStatus = "live" | "reconnecting" | "offline";

type LiveState = {
  status: LiveStatus;
  setStatus: (s: LiveStatus) => void;
};

export const useLiveStore = create<LiveState>((set) => ({
  status: "offline",
  setStatus: (status) => set((s) => (s.status === status ? s : { status })),
}));
