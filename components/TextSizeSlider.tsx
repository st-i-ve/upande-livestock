import React, { useRef, useState } from "react";
import { AccessibilityInfo, PanResponder, StyleSheet, View, type LayoutChangeEvent } from "react-native";

import { useColors } from "@/src/hooks/useColors";
import { MAX_TEXT_SCALE, MIN_TEXT_SCALE, TEXT_SCALE_STEP, snapTextScale, textScalePercent } from "@/src/theme/textScale";

const THUMB = 30;
const HEIGHT = 48; // touch target

/**
 * A horizontal slider over the text-scale range, in 0.05 steps. Dragging or
 * tapping the track sets the value live; screen readers get "adjustable" with
 * increment/decrement actions.
 */
export function TextSizeSlider({ value, onChange, testID }: { value: number; onChange: (v: number) => void; testID?: string }) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const span = Math.max(1, width - THUMB);
  const frac = (value - MIN_TEXT_SCALE) / (MAX_TEXT_SCALE - MIN_TEXT_SCALE);

  const live = useRef({ span, onChange, value });
  live.current = { span, onChange, value };

  const setFromX = (x: number) => {
    const f = Math.min(1, Math.max(0, (x - THUMB / 2) / live.current.span));
    const next = snapTextScale(MIN_TEXT_SCALE + f * (MAX_TEXT_SCALE - MIN_TEXT_SCALE));
    if (next !== live.current.value) live.current.onChange(next);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
    }),
  ).current;
  const measure = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const nudge = (d: number) => {
    const next = snapTextScale(value + d * TEXT_SCALE_STEP);
    if (next !== value) {
      onChange(next);
      AccessibilityInfo.announceForAccessibility?.(textScalePercent(next));
    }
  };

  return (
    <View
      testID={testID}
      onLayout={measure}
      {...pan.panHandlers}
      style={s.wrap}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Text size"
      accessibilityValue={{ min: Math.round(MIN_TEXT_SCALE * 100), max: Math.round(MAX_TEXT_SCALE * 100), now: Math.round(value * 100), text: textScalePercent(value) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === "increment" ? 1 : -1)}
    >
      <View pointerEvents="none" style={[s.track, { backgroundColor: c.border }]} />
      <View pointerEvents="none" style={[s.fill, { backgroundColor: c.text, width: THUMB / 2 + frac * span }]} />
      <View pointerEvents="none" style={[s.thumb, { backgroundColor: c.text, borderColor: c.bg, left: frac * span }]} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, height: HEIGHT, justifyContent: "center" },
  track: { position: "absolute", left: 0, right: 0, height: 6, borderRadius: 3 },
  fill: { position: "absolute", left: 0, height: 6, borderRadius: 3 },
  thumb: { position: "absolute", width: THUMB, height: THUMB, borderRadius: THUMB / 2, borderWidth: 3, elevation: 3 },
});
