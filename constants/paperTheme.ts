// React Native Paper theme, Scout-style. Monochrome MD3 palette with Poppins
// fonts and custom elevation levels, flipped by colour scheme.
import {
  MD3DarkTheme,
  MD3LightTheme,
  configureFonts,
  type MD3Theme,
} from "react-native-paper";

const INK = "#080808"; // primary text / accent
const PAPER = "#FFFFFF"; // background
const GRAPHITE = "#2B2B2B"; // secondary
const DIM = "#6E6E6E"; // tertiary / outline
const DANGER = "#A32D2D";

const LIGHT_ELEVATION = {
  level0: "transparent",
  level1: "#F6F6F6",
  level2: "#F1F1F1",
  level3: "#ECECEC",
  level4: "#E9E9E9",
  level5: "#E5E5E5",
} as const;

const DARK_ELEVATION = {
  level0: "transparent",
  level1: "#161616",
  level2: "#1C1C1C",
  level3: "#212121",
  level4: "#242424",
  level5: "#2A2A2A",
} as const;

// React Native does not synthesise weights from a single face, but Paper's
// variants only need one family; the app's Text.render patch handles weight
// mapping globally. Point Paper at the regular Poppins face.
const fonts = configureFonts({
  config: { fontFamily: "Poppins_400Regular" },
});

export function getPaperTheme(scheme: "light" | "dark" | null | undefined): MD3Theme {
  const dark = scheme === "dark";
  const base = dark ? MD3DarkTheme : MD3LightTheme;
  return {
    ...base,
    dark,
    fonts,
    colors: {
      ...base.colors,
      primary: dark ? PAPER : INK,
      onPrimary: dark ? INK : PAPER,
      secondary: dark ? "#E0E0E0" : GRAPHITE,
      onSecondary: dark ? INK : PAPER,
      background: dark ? INK : PAPER,
      onBackground: dark ? PAPER : INK,
      surface: dark ? INK : PAPER,
      onSurface: dark ? PAPER : INK,
      surfaceVariant: dark ? "#1C1C1C" : "#F0F0F0",
      onSurfaceVariant: dark ? "#A0A0A0" : GRAPHITE,
      outline: dark ? "#A0A0A0" : DIM,
      outlineVariant: dark ? "#2A2A2A" : "#E5E5E5",
      error: DANGER,
      onError: PAPER,
      elevation: dark ? DARK_ELEVATION : LIGHT_ELEVATION,
    },
  };
}

// Semantic banner colours for the login screen (Scout values).
export const BANNER_COLORS = {
  light: {
    error: { bg: "#FDECEA", fg: "#B3261E" },
    warning: { bg: "#FEF3E2", fg: "#8A5A00" },
  },
  dark: {
    error: { bg: "#3A1714", fg: "#F2B8B5" },
    warning: { bg: "#3A2E12", fg: "#FFD8A8" },
  },
} as const;
