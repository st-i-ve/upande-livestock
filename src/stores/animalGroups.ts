import { create } from "zustand";

// Which herd groups are open on the Animals list. Session-only on purpose.
type State = {
  open: Record<string, boolean>;
  toggle: (herd: string) => void;
  setAll: (herds: string[], open: boolean) => void;
};

export const useAnimalGroups = create<State>((set) => ({
  open: {},
  toggle: (herd) => set((st) => ({ open: { ...st.open, [herd]: !st.open[herd] } })),
  setAll: (herds, open) =>
    set((st) => {
      const next = { ...st.open };
      for (const h of herds) next[h] = open;
      return { open: next };
    }),
}));
