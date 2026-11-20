import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { useColors } from "@/src/hooks/useColors";

const PAD = 4;
const SLIDE = { duration: 260, easing: Easing.inOut(Easing.cubic) };

export type PillOption<T extends string> = {
  id: T;
  /** Spoken label, e.g. "Dark theme". */
  label: string;
  /** What to draw in the segment; `on` says whether it is the chosen one. */
  render: (on: boolean) => React.ReactNode;
};

/**
 * A pill-shaped segmented control: a fully rounded track with one rounded
 * thumb that slides (ease-in-out) under the chosen option. Theme colours: the
 * track is bgMuted, the thumb the text colour, so the chosen label is drawn in
 * the background colour. Reduce motion: the thumb jumps.
 *
 *   <PillSegmented value={pref} onChange={setPref} options={[{ id, label, render }]} />
 */
export function PillSegmented<T extends string>({
  value,
  onChange,
  options,
  minHeight = 44,
  style,
  testID,
}: {
  value: T;
  onChange: (id: T) => void;
  options: readonly PillOption<T>[];
  minHeight?: number;
  style?: ViewStyle;
  testID?: string;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.id === value));
  const segW = width > 0 ? (width - PAD * 2) / options.length : 0;

  const x = useSharedValue(0);
  const placed = useSharedValue(false);
  useEffect(() => {
    if (!segW) return;
    const to = index * segW;
    // First placement (and reduce motion) without a slide.
    x.value = placed.value && !reduceMotion ? withTiming(to, SLIDE) : to;
    placed.value = true;
  }, [index, segW, reduceMotion, x, placed]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      style={[s.track, { minHeight }, style]}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="radiogroup"
      testID={testID}
    >
      {segW > 0 ? <Animated.View pointerEvents="none" style={[s.thumb, { width: segW }, thumb]} /> : null}
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.label}
            style={({ pressed }) => [s.seg, !on && pressed && { opacity: 0.6 }]}
          >
            {o.render(on)}
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    track: {
      flexDirection: "row",
      backgroundColor: c.bgMuted,
      borderRadius: 999,
      padding: PAD,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderSubtle,
    },
    thumb: {
      position: "absolute",
      top: PAD,
      bottom: PAD,
      left: PAD,
      borderRadius: 999,
      backgroundColor: c.text,
    },
    seg: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 4,
      borderRadius: 999,
      minWidth: 0,
    },
  });
