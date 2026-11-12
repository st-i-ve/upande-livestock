import { create } from "zustand";

/** The connection sheet (the green dot's), drawn once over the whole app by StatusSheetHost. */
export const useStatusSheet = create<{ open: boolean; show: () => void; hide: () => void }>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));
