import { DARK, LIGHT, type Palette } from "@/constants/theme";
import { useScheme } from "@/src/theme/themeStore";

// Resolve the active palette from the effective colour scheme (OS or the
// manual override set on the profile screen). Same key shape as the static
// COLORS export.
export function useColors(): Palette {
  return useScheme() === "dark" ? DARK : LIGHT;
}
