import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import type { StandingView } from "@/src/standingRadar";

/** Chart | List on "Performance vs other animals". Null until the user picks one
 *  (the section then follows the ≥3-measures rule). Persisted across launches. */
const KEY = "standing.view";

type State = {
  chosen: StandingView | null;
  hydrated: boolean;
  set: (v: StandingView) => void;
  hydrate: () => Promise<void>;
};

export const useStandingView = create<State>((set, get) => ({
  chosen: null,
  hydrated: false,
  set: (v) => {
    set({ chosen: v, hydrated: true });
    AsyncStorage.setItem(KEY, v).catch(() => {});
  },
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const v = await AsyncStorage.getItem(KEY);
      // A choice made while hydrating wins over the stored one.
      if (!get().hydrated) set({ chosen: v === "chart" || v === "list" ? v : null, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));
