import { describe, expect, it } from "../../__tests__/jestLike.ts";
import {
  DEFAULT_TEXT_SCALE, MAX_TEXT_SCALE, MIN_TEXT_SCALE, snapTextScale, textScalePercent, TOTAL_SCALE_CAP, effectiveScale, maxOsMultiplier,
  parseTextScale, parseThemePref, scaleSize, textStepOf,
} from "../textScale.ts";

describe("reading the stored preferences back", () => {
  it("theme: light and dark as stored, anything else follows the system", () => {
    expect(parseThemePref("light")).toBe("light");
    expect(parseThemePref("dark")).toBe("dark");
    expect(parseThemePref("system")).toBe("system");
    expect(parseThemePref(null)).toBe("system");
    expect(parseThemePref("Dark")).toBe("system");
  });

  it("text scale: old levels load as they were, others clamp and snap", () => {
    expect(parseTextScale("1.15")).toBe(1.15);
    expect(parseTextScale("0.9")).toBe(0.9);
    expect(parseTextScale("1.3")).toBe(1.3);
    expect(parseTextScale("1.12")).toBe(1.1);
    expect(parseTextScale("2")).toBe(MAX_TEXT_SCALE);
    expect(parseTextScale("0.5")).toBe(MIN_TEXT_SCALE);
    expect(parseTextScale(null)).toBe(DEFAULT_TEXT_SCALE);
    expect(parseTextScale("")).toBe(DEFAULT_TEXT_SCALE);
    expect(parseTextScale("big")).toBe(DEFAULT_TEXT_SCALE);
    expect(parseTextScale("-1")).toBe(DEFAULT_TEXT_SCALE);
  });

  it("snaps to 0.05 within the range and labels as a percent", () => {
    expect(snapTextScale(1.07)).toBe(1.05);
    expect(snapTextScale(NaN)).toBe(1);
    expect(textScalePercent(1.15)).toBe("115%");
    expect(textStepOf(1.3).label).toBe("130%");
  });
});

describe("scale maths", () => {
  it("scales a size to the half point", () => {
    expect(scaleSize(16, 1)).toBe(16);
    expect(scaleSize(16, 1.15)).toBe(18.5);
    expect(scaleSize(16, 1.3)).toBe(21);
    expect(scaleSize(14, 0.9)).toBe(12.5);
  });

  it("the phone's font scale on top never takes the total past the cap", () => {
    for (let i = 0; i <= 11; i++) {
      const scale = snapTextScale(MIN_TEXT_SCALE + i * 0.05);
      for (const os of [0.85, 1, 1.3, 1.5, 2, 3]) {
        expect(effectiveScale(scale, os)).toBeLessThanOrEqual(TOTAL_SCALE_CAP + 0.01);
      }
    }
    expect(effectiveScale(1.3, 2)).toBeCloseTo(1.6, 2);
    expect(effectiveScale(1, 2)).toBeCloseTo(1.6, 2);
  });

  it("under the cap the two simply multiply", () => {
    expect(effectiveScale(1, 1)).toBe(1);
    expect(effectiveScale(1.15, 1.2)).toBeCloseTo(1.38, 5);
    expect(effectiveScale(0.9, 0.85)).toBeCloseTo(0.765, 5);
  });

  it("the phone's share is never limited below 1", () => {
    expect(maxOsMultiplier(1)).toBe(1.6);
    expect(maxOsMultiplier(1.3)).toBeCloseTo(1.231, 3);
    expect(maxOsMultiplier(2)).toBe(1);
  });
});


