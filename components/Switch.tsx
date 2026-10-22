import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useColors } from "@/src/hooks/useColors";

const W = 58;
const H = 32;
const PAD = 3;
const THUMB = H - PAD * 2;

/**
 * The same track-and-thumb switch as `ThemeToggle` (profile screen), pulled
 * out so any other on/off control on the desk or in the app can share the
 * construction instead of re-implementing it: `Pressable` +
 * `react-native-reanimated`'s `withTiming`, no new native module. `ThemeToggle`
 * itself is not on this primitive yet — it predates it — but could reasonably
 * move onto it later.
 */
export function Switch({
  checked,
  onChange,
  accessibilityLabel,
  icon,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  accessibilityLabel: string;
  /** Icon shown inside the thumb, reflecting the current state. */
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const p = useSharedValue(checked ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(checked ? 1 : 0, { duration: 240, easing: Easing.out(Easing.cubic) });
  }, [checked, p]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: p.value * (W - THUMB - PAD * 2) }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      onPress={() => onChange(!checked)}
      style={s.track}
      hitSlop={8}
    >
      <Animated.View style={[s.thumb, thumbStyle]}>
        {icon ? <MaterialCommunityIcons name={icon} size={16} color={c.text} /> : null}
      </Animated.View>
    </Pressable>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    track: {
      width: W,
      height: H,
      borderRadius: H / 2,
      backgroundColor: c.bgMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderSubtle,
      justifyContent: "center",
      paddingHorizontal: PAD,
    },
    thumb: {
      width: THUMB,
      height: THUMB,
      borderRadius: THUMB / 2,
      backgroundColor: c.bg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
  });
