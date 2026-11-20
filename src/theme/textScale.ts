/**
 * Accessibility preferences, the pure half: the theme choice and the text size
 * steps, how a stored value is read back, and the arithmetic that scales a font
 * size without letting the app's choice and the phone's own text size multiply
 * past a cap. No React, no storage — the store (themeStore) and the patched
 * Text (patchText) use these.
 */

export type ThemePref = "system" | "light" | "dark";

/** What the phone stores for "follow the OS" (the key predates this module). */
export const parseThemePref = (v: string | null | undefined): ThemePref =>
  v === "light" || v === "dark" ? v : "system";

export type TextStep = { id: string; label: string; scale: number };

export const TEXT_STEPS: readonly TextStep[] = [
  { id: "small", label: "Small", scale: 0.9 },
  { id: "default", label: "Default", scale: 1 },
  { id: "large", label: "Large", scale: 1.15 },
  { id: "xl", label: "Extra large", scale: 1.3 },
];

export const DEFAULT_TEXT_SCALE = 1;

/** The app's scale times the phone's never goes past this. */
export const TOTAL_SCALE_CAP = 1.6;

/** A stored scale, read back as one of the steps (anything else is Default). */
export function parseTextScale(v: string | null | undefined): number {
  const n = v == null ? NaN : Number(v);
  const step = TEXT_STEPS.find((s) => Math.abs(s.scale - n) < 1e-6);
  return step ? step.scale : DEFAULT_TEXT_SCALE;
}

export const textStepOf = (scale: number): TextStep =>
  TEXT_STEPS.find((s) => Math.abs(s.scale - scale) < 1e-6) ?? TEXT_STEPS[1];

/** A font size (or line height) at the app's scale, to the half point. */
export function scaleSize(size: number, scale: number): number {
  return Math.round(size * scale * 2) / 2;
}

/**
 * The `maxFontSizeMultiplier` for a Text at the app's scale: React Native
 * multiplies by the phone's font scale on top of ours, so the phone's share is
 * limited to what keeps the product under the cap — never below 1, so a phone
 * set larger than default is still honoured at least as much as ours.
 */
export function maxOsMultiplier(appScale: number, cap = TOTAL_SCALE_CAP): number {
  return Math.max(1, Math.round((cap / appScale) * 1000) / 1000);
}

/** What a 16 pt line ends up at: the app's scale times the phone's, capped. */
export function effectiveScale(appScale: number, osScale: number, cap = TOTAL_SCALE_CAP): number {
  return appScale * Math.min(Math.max(osScale, 0), maxOsMultiplier(appScale, cap));
}
