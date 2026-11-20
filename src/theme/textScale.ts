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

export const MIN_TEXT_SCALE = 0.85;
export const MAX_TEXT_SCALE = 1.4;
export const TEXT_SCALE_STEP = 0.05;
export const DEFAULT_TEXT_SCALE = 1;

/** The app's scale times the phone's never goes past this. */
export const TOTAL_SCALE_CAP = 1.6;

/** Any number clamped to the slider's range and snapped to its 0.05 steps. */
export function snapTextScale(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_TEXT_SCALE;
  const c = Math.min(MAX_TEXT_SCALE, Math.max(MIN_TEXT_SCALE, n));
  return Math.round(Math.round(c / TEXT_SCALE_STEP) * TEXT_SCALE_STEP * 100) / 100;
}

/**
 * A stored scale read back: a number (the old levels 0.9, 1, 1.15, 1.3 are
 * numbers too, and load as they were), clamped and snapped; junk is Default.
 */
export function parseTextScale(v: string | null | undefined): number {
  if (v == null || v.trim() === "") return DEFAULT_TEXT_SCALE;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? snapTextScale(n) : DEFAULT_TEXT_SCALE;
}

/** "115%" for a scale. */
export const textScalePercent = (scale: number): string => `${Math.round(scale * 100)}%`;

export const textStepOf = (scale: number): TextStep => ({
  id: String(scale),
  label: textScalePercent(scale),
  scale,
});

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
