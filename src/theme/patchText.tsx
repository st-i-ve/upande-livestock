import React from "react";

import { FONT_FAMILY } from "@/constants/theme";

// RN 0.81's Text is a plain function component (no `.render`), so the old
// Text.render monkey-patch was a silent no-op. Instead we redefine the
// `Text` getter on the react-native module object (it's a configurable
// object-literal getter) to return a wrapper that injects the correct Poppins
// face and a uniform font size. Every `import { Text } from "react-native"`
// resolves through this getter, so this applies app-wide.

// Weight → Poppins face. Bold is toned down: heavy weights resolve to SemiBold
// so the UI reads calmer, with emphasis carried by SemiBold not a heavy Bold.
const WEIGHT_TO_FAMILY: Record<string, string> = {
  "500": FONT_FAMILY.medium,
  "600": FONT_FAMILY.semibold,
  "700": FONT_FAMILY.semibold,
  "800": FONT_FAMILY.semibold,
  "900": FONT_FAMILY.semibold,
  bold: FONT_FAMILY.semibold,
};

function resolveFamily(flat: any): string {
  if (flat?.fontFamily) return flat.fontFamily;
  const w = flat?.fontWeight;
  if (w !== undefined && w !== null) return WEIGHT_TO_FAMILY[String(w)] ?? FONT_FAMILY.regular;
  return FONT_FAMILY.regular;
}

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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const RN: any = require("react-native");

if (!RN.__poppinsTextPatched) {
  const OriginalText = RN.Text;
  const StyleSheet = RN.StyleSheet;

  const PoppinsText = React.forwardRef(function PoppinsText(props: any, ref: any) {
    const flat = StyleSheet.flatten(props.style);
    const fontFamily = resolveFamily(flat);
    const fontSize = snapFontSize(flat?.fontSize);
    return React.createElement(OriginalText, {
      ...props,
      ref,
      style: [{ fontFamily }, props.style, fontSize != null ? { fontSize } : null],
    });
  });
  (PoppinsText as any).displayName = "PoppinsText";

  try {
    Object.defineProperty(RN, "Text", {
      configurable: true,
      enumerable: true,
      get: () => PoppinsText,
    });
    RN.__poppinsTextPatched = true;
  } catch {
    // If the property can't be redefined, fall back silently (no global font).
  }
}

export {};
