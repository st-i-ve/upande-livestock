import "@/src/theme/patchText";

import React from "react";
import { StyleSheet, Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import { useThemeStore } from "@/src/theme/themeStore";

// The patched Text applies the Accessibility text size to every Text in the app.
function sizeOf(el: React.ReactElement) {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(el);
  });
  const host = r.root.findAll((n) => typeof n.type === "string")[0];
  return { style: StyleSheet.flatten(host.props.style), max: host.props.maxFontSizeMultiplier };
}

describe("app-wide text size", () => {
  afterEach(() => useThemeStore.setState({ textScale: 1 }));

  it("leaves sizes as they were at Default", () => {
    const { style, max } = sizeOf(<Text style={{ fontSize: 16, lineHeight: 22 }}>x</Text>);
    expect(style.fontSize).toBe(16);
    expect(style.lineHeight).toBe(22);
    expect(max).toBe(1.6);
  });

  it("scales size and line height at Extra large, and limits the phone's share", () => {
    useThemeStore.setState({ textScale: 1.3 });
    const { style, max } = sizeOf(<Text style={{ fontSize: 16, lineHeight: 22 }}>x</Text>);
    expect(style.fontSize).toBe(21);
    expect(style.lineHeight).toBe(28.5);
    expect(max).toBeCloseTo(1.231, 3);
  });

  it("gives unsized text RN's default size, scaled", () => {
    useThemeStore.setState({ textScale: 1.15 });
    expect(sizeOf(<Text>x</Text>).style.fontSize).toBe(16);
  });

  it("leaves fixed-size text (icons) alone", () => {
    useThemeStore.setState({ textScale: 1.3 });
    expect(sizeOf(<Text allowFontScaling={false} style={{ fontSize: 20 }}>x</Text>).style.fontSize).toBe(20);
  });
});
