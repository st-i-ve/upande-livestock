import { create } from "zustand";

/**
 * Which tab page shows the connection dot right now: the focused page whose
 * header has a slot for it. The dot itself is drawn once, in one fixed place
 * (FloatingOnlineDot), so it never moves between pages; this only says
 * whether it shows. One page owns it at a time.
 */
type DotOwnerState = {
  owner: string | null;
  claim: (owner: string) => void;
  release: (owner: string) => void;
};

export const useDotAnchor = create<DotOwnerState>((set, get) => ({
  owner: null,
  claim: (owner) => {
    if (get().owner !== owner) set({ owner });
  },
  // Only the owner can let go, so a page blurring after the next one claimed
  // the dot never hides it.
  release: (owner) => {
    if (get().owner === owner) set({ owner: null });
  },
}));
