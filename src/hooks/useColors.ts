import { useColorScheme } from "react-native";

import { DARK, LIGHT, type Palette } from "@/constants/theme";

// Resolve the active palette from the OS colour scheme. Same key shape as the
// static COLORS export, so migrating a component is: replace
// `import { COLORS } from "@/constants/theme"` with
// `const COLORS = useColors()` inside the component body, and move any
// colour-dependent StyleSheet.create into the body (or split colour styles out).
export function useColors(): Palette {
  const scheme = useColorScheme();
  return scheme === "dark" ? DARK : LIGHT;
}
