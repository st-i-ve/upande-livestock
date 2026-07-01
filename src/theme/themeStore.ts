import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "react-native";
import { create } from "zustand";

// Theme override: null = follow the OS; "light"/"dark" = manual choice from the
// profile toggle. Persisted so the choice sticks across launches.
type Override = "light" | "dark" | null;
const KEY = "theme.override";

interface ThemeState {
  override: Override;
  hydrated: boolean;
  setOverride: (o: Override) => void;
  hydrate: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  override: null,
  hydrated: false,
  setOverride: (o) => {
    set({ override: o });
    AsyncStorage.setItem(KEY, o ?? "system").catch(() => {});
  },
  hydrate: async () => {
    try {
      const v = await AsyncStorage.getItem(KEY);
      set({ override: v === "light" || v === "dark" ? v : null, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));

// Effective colour scheme: manual override wins, else follow the OS.
export function useScheme(): "light" | "dark" {
  const os = useColorScheme();
  const override = useThemeStore((s) => s.override);
  return override ?? (os === "dark" ? "dark" : "light");
}
