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
import { useScheme, useThemeStore } from "@/src/theme/themeStore";

const W = 58;
const H = 32;
const PAD = 3;
const THUMB = H - PAD * 2;

// A compact light/dark switch. The thumb slides with an easing animation and
// carries a sun/moon icon reflecting the active theme.
export function ThemeToggle() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const dark = useScheme() === "dark";
  const setOverride = useThemeStore((st) => st.setOverride);

  const p = useSharedValue(dark ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(dark ? 1 : 0, { duration: 240, easing: Easing.out(Easing.cubic) });
  }, [dark, p]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: p.value * (W - THUMB - PAD * 2) }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: dark }}
      accessibilityLabel="Toggle dark mode"
      onPress={() => setOverride(dark ? "light" : "dark")}
      style={s.track}
      hitSlop={8}
    >
      <Animated.View style={[s.thumb, thumbStyle]}>
        <MaterialCommunityIcons
          name={dark ? "moon-waning-crescent" : "white-balance-sunny"}
          size={16}
          color={c.text}
        />
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
