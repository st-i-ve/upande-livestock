import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  DEFAULT_TEXT_SCALE,
  TEXT_STEPS,
  TOTAL_SCALE_CAP,
  effectiveScale,
  maxOsMultiplier,
  parseTextScale,
  parseThemePref,
  scaleSize,
  textStepOf,
} from "@/src/theme/textScale";
import { TEXT_SCALE_KEY, THEME_KEY, useThemeStore } from "@/src/theme/themeStore";

describe("reading the stored preferences back", () => {
  it("theme: light and dark as stored, anything else follows the system", () => {
    expect(parseThemePref("light")).toBe("light");
    expect(parseThemePref("dark")).toBe("dark");
    expect(parseThemePref("system")).toBe("system");
    expect(parseThemePref(null)).toBe("system");
    expect(parseThemePref("Dark")).toBe("system");
  });

  it("text scale: only a known step, else Default", () => {
    expect(parseTextScale("1.15")).toBe(1.15);
    expect(parseTextScale("0.9")).toBe(0.9);
    expect(parseTextScale("1.3")).toBe(1.3);
    expect(parseTextScale(null)).toBe(DEFAULT_TEXT_SCALE);
    expect(parseTextScale("")).toBe(DEFAULT_TEXT_SCALE);
    expect(parseTextScale("2")).toBe(DEFAULT_TEXT_SCALE);
    expect(parseTextScale("big")).toBe(DEFAULT_TEXT_SCALE);
  });

  it("names the step for a scale", () => {
    expect(TEXT_STEPS.map((s) => s.scale)).toEqual([0.9, 1, 1.15, 1.3]);
    expect(textStepOf(1.3).label).toBe("Extra large");
    expect(textStepOf(7).label).toBe("Default");
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
    for (const { scale } of TEXT_STEPS) {
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

describe("the preference store", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useThemeStore.setState({ override: null, textScale: DEFAULT_TEXT_SCALE, hydrated: false });
  });

  it("defaults to System and Default when nothing is stored", async () => {
    await useThemeStore.getState().hydrate();
    const st = useThemeStore.getState();
    expect(st.override).toBeNull();
    expect(st.textScale).toBe(1);
    expect(st.hydrated).toBe(true);
  });

  it("remembers both choices and restores them", async () => {
    useThemeStore.getState().setThemePref("dark");
    useThemeStore.getState().setTextScale(1.3);
    expect(await AsyncStorage.getItem(THEME_KEY)).toBe("dark");
    expect(await AsyncStorage.getItem(TEXT_SCALE_KEY)).toBe("1.3");

    useThemeStore.setState({ override: null, textScale: 1, hydrated: false });
    await useThemeStore.getState().hydrate();
    expect(useThemeStore.getState().override).toBe("dark");
    expect(useThemeStore.getState().textScale).toBe(1.3);
  });

  it("System is stored as 'system' and read back as no override", async () => {
    useThemeStore.getState().setThemePref("light");
    useThemeStore.getState().setThemePref("system");
    expect(await AsyncStorage.getItem(THEME_KEY)).toBe("system");
    await useThemeStore.getState().hydrate();
    expect(useThemeStore.getState().override).toBeNull();
  });

  it("an odd stored scale falls back to Default; a setter snaps to a step", async () => {
    await AsyncStorage.setItem(TEXT_SCALE_KEY, "1.27");
    await useThemeStore.getState().hydrate();
    expect(useThemeStore.getState().textScale).toBe(1);
    useThemeStore.getState().setTextScale(5);
    expect(useThemeStore.getState().textScale).toBe(1);
  });
});
