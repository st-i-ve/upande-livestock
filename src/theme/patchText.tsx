import React from "react";

import { fontFamilyFor } from "@/constants/theme";
import { maxOsMultiplier, scaleSize } from "@/src/theme/textScale";
import { useThemeStore } from "@/src/theme/themeStore";

// RN 0.81's Text is a plain function component (no `.render`), so the old
// Text.render monkey-patch was a silent no-op. Instead we redefine the
// `Text` getter on the react-native module object (it's a configurable
// object-literal getter) to return a wrapper that injects the correct Poppins
// face and a uniform font size. Every `import { Text } from "react-native"`
// resolves through this getter, so this applies app-wide.

const MONO = new Set(["monospace", "sans-serif", "serif", "normal", "System"]);

function resolveFamily(flat: any): string {
  const f = flat?.fontFamily;
  if (f && !MONO.has(f)) return f;
  return fontFamilyFor(flat?.fontWeight);
}

// Nested <Text> inherits its parent's face, so only the outermost text (and any
// text that sets its own family or weight) gets the default injected.
const InText = React.createContext(false);

// Uniform, larger type scale (raised floor). Sizes >= 30 pass through
// (intentional display text like the login title); Text with no explicit size
// is left alone so nested-Text inheritance still works.
//   caption 14 · body 16 · heading 20 · display 26
function snapFontSize(size: number | undefined): number | undefined {
  if (typeof size !== "number") return undefined;
  if (size >= 30) return size;
  if (size <= 13) return 14;
  if (size <= 16) return 16;
  if (size <= 22) return 20;
  return 26;
}

// RN's own default when a Text sets no size.
const RN_DEFAULT_SIZE = 14;

/**
 * The text size step from Profile > Accessibility, applied here so every Text
 * and TextInput follows it without each screen knowing. A size (and a numeric
 * line height, which would otherwise clip the larger glyphs) is multiplied by
 * the app's scale; the phone's own font scale still applies on top, limited by
 * `maxFontSizeMultiplier` so the two together stay under the cap. A nested Text
 * with no size inherits its parent's, already scaled, so it is left alone.
 * Text that opts out of font scaling (`allowFontScaling={false}`: every
 * @expo/vector-icons glyph, so icons in a tab bar or a round button keep their
 * box) is left at its size here too.
 */
function scaled(flat: any, fontSize: number | undefined, nested: boolean, scale: number) {
  if (scale === 1) return fontSize != null ? { fontSize } : null;
  const base = fontSize ?? (nested ? undefined : RN_DEFAULT_SIZE);
  const out: { fontSize?: number; lineHeight?: number } = {};
  if (base != null) out.fontSize = scaleSize(base, scale);
  if (typeof flat?.lineHeight === "number") out.lineHeight = scaleSize(flat.lineHeight, scale);
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const RN: any = require("react-native");

if (!RN.__poppinsTextPatched) {
  const OriginalText = RN.Text;
  const StyleSheet = RN.StyleSheet;

  const PoppinsText = React.forwardRef(function PoppinsText(props: any, ref: any) {
    const nested = React.useContext(InText);
    const appScale = useThemeStore((st) => st.textScale);
    const scale = props.allowFontScaling === false ? 1 : appScale;
    const flat = StyleSheet.flatten(props.style);
    const own = flat?.fontFamily && !MONO.has(flat.fontFamily);
    const fontFamily = resolveFamily(flat);
    const fontSize = snapFontSize(flat?.fontSize);
    const inherit = nested && !own && flat?.fontWeight == null;
    const el = React.createElement(OriginalText, {
      ...props,
      ref,
      maxFontSizeMultiplier: props.maxFontSizeMultiplier ?? maxOsMultiplier(scale),
      style: [inherit ? null : { fontFamily }, props.style, inherit ? null : fontFamily === flat?.fontFamily ? null : { fontWeight: "normal" }, scaled(flat, fontSize, nested, scale)],
    });
    return nested ? el : React.createElement(InText.Provider, { value: true }, el);
  });
  (PoppinsText as any).displayName = "PoppinsText";

  // TextInput (and its placeholder) take their face from the style too.
  const OriginalInput = RN.TextInput;
  const PoppinsInput = React.forwardRef(function PoppinsInput(props: any, ref: any) {
    const appScale = useThemeStore((st) => st.textScale);
    const scale = props.allowFontScaling === false ? 1 : appScale;
    const flat = StyleSheet.flatten(props.style);
    const fontFamily = resolveFamily(flat);
    const fontSize = snapFontSize(flat?.fontSize);
    return React.createElement(OriginalInput, {
      ...props,
      ref,
      maxFontSizeMultiplier: props.maxFontSizeMultiplier ?? maxOsMultiplier(scale),
      style: [{ fontFamily }, props.style, { fontWeight: "normal" }, scaled(flat, fontSize, false, scale)],
    });
  });
  (PoppinsInput as any).displayName = "PoppinsTextInput";
  try {
    Object.assign(PoppinsInput, OriginalInput);
  } catch {
    // statics are a convenience only
  }

  try {
    Object.defineProperty(RN, "Text", {
      configurable: true,
      enumerable: true,
      get: () => PoppinsText,
    });
    Object.defineProperty(RN, "TextInput", {
      configurable: true,
      enumerable: true,
      get: () => PoppinsInput,
    });
    RN.__poppinsTextPatched = true;
  } catch {
    // If the property can't be redefined, fall back silently (no global font).
  }
}

export {};
