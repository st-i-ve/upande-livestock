// Design tokens — monochrome system per the blueprint (§16.9).
// Distinguish sections by icons and layout, not colour. `danger` is the only
// colour with real meaning; reserve it for actual errors.

export const COLORS = {
  // Surfaces
  bg: "#FFFFFF",
  bgMuted: "#F5F5F5",
  bgSubtle: "#FAFAFA",
  // Text
  text: "#0A0A0A",
  textMuted: "#525252",
  textSubtle: "#A3A3A3",
  // Borders
  border: "#D4D4D4",
  borderSubtle: "#E5E5E5",
  // Brand / interactive accent — all black in a monochrome system
  primary: "#000000",
  info: "#000000",
  success: "#000000",
  // Warn = darker grey, not orange. Danger = the only meaningful colour.
  warning: "#4B5563",
  danger: "#A32D2D",
  // Legacy keys mapped to monochrome equivalents so existing components
  // keep compiling without further edits. Do not introduce new tinted keys.
  brand: "#000000",
} as const;

export const RADIUS = { sm: 6, md: 8, lg: 12, xl: 14 } as const;
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

// Poppins font families. Use the exact variant matching the desired weight —
// React Native does not synthesise bold from a regular font file, so we load
// every weight we want to use explicitly via @expo-google-fonts/poppins.
export const FONT_FAMILY = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
} as const;

export const FONT = {
  page: { size: 16, weight: "600" as const },
  card: { size: 14, weight: "600" as const },
  body: { size: 13, weight: "400" as const },
  meta: { size: 11, weight: "400" as const },
  label: { size: 11, weight: "500" as const },
  metric: { size: 22, weight: "700" as const },
  section: { size: 11, weight: "600" as const },
} as const;

export const APP = {
  farm: "Westwood Dairies",
  location: "Kapkolia · 462 head",
  user: "Abraham K. Sikuku",
  initials: "AK",
  emp: "500208",
  milkPriceKES: 60,
  today: "2026-05-09",
  version: "1.0.0",
} as const;
