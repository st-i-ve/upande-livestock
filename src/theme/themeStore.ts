import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "react-native";
import { create } from "zustand";

import { DEFAULT_TEXT_SCALE, parseTextScale, parseThemePref, type ThemePref } from "@/src/theme/textScale";

// Theme override: null = follow the OS; "light"/"dark" = manual choice from
// Profile > Accessibility. Text scale: the app's own text size step. Both
// persisted, and read in the root layout before the splash goes, so the first
// frame is already in the chosen theme and size.
type Override = "light" | "dark" | null;
export const THEME_KEY = "theme.override";
export const TEXT_SCALE_KEY = "text.scale";

interface ThemeState {
  override: Override;
  textScale: number;
  hydrated: boolean;
  setOverride: (o: Override) => void;
  setThemePref: (p: ThemePref) => void;
  setTextScale: (scale: number) => void;
  hydrate: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  override: null,
  textScale: DEFAULT_TEXT_SCALE,
  hydrated: false,
  setOverride: (o) => {
    set({ override: o });
    AsyncStorage.setItem(THEME_KEY, o ?? "system").catch(() => {});
  },
  setThemePref: (p) => get().setOverride(p === "system" ? null : p),
  setTextScale: (scale) => {
    const s = parseTextScale(String(scale));
    set({ textScale: s });
    AsyncStorage.setItem(TEXT_SCALE_KEY, String(s)).catch(() => {});
  },
  hydrate: async () => {
    try {
      const [[, theme], [, scale]] = await AsyncStorage.multiGet([THEME_KEY, TEXT_SCALE_KEY]);
      const pref = parseThemePref(theme);
      set({ override: pref === "system" ? null : pref, textScale: parseTextScale(scale), hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));

/** The choice as the Accessibility screen shows it. */
export const useThemePref = (): ThemePref => useThemeStore((s) => s.override ?? "system");

export const useTextScale = (): number => useThemeStore((s) => s.textScale);

// Effective colour scheme: manual override wins, else follow the OS.
export function useScheme(): "light" | "dark" {
  const os = useColorScheme();
  const override = useThemeStore((s) => s.override);
  return override ?? (os === "dark" ? "dark" : "light");
}
