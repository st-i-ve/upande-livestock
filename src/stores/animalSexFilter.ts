import { create } from "zustand";

/** The All / Cows / Bulls choice on the Animals list. Bulls = every male. Kept for the app's lifetime. */
export type SexFilter = "all" | "cows" | "bulls";

export const useAnimalSexFilter = create<{ value: SexFilter; set: (v: SexFilter) => void }>((set) => ({
  value: "all",
  set: (value) => set({ value }),
}));

export const sexMatches = (f: SexFilter, sex: string | null | undefined) =>
  f === "all" || (f === "bulls" ? sex === "M" : sex !== "M");
