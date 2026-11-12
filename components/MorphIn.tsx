import React, { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useLoginExit } from "@/src/logo/loginLogo";

/** How long the first screen after a login takes to settle in. */
export const MORPH_IN_MS = 700;

/**
 * The first screen after a login grows softly into place (a touch small and
 * clear, to full size and solid, eased in and out), so leaving the login
 * screen reads as one page turning into the next rather than a cut. Anywhere
 * else it is a plain wrapper.
 */
export function MorphIn({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  // Taken once, on mount: only the screen the login lands on morphs.
  const [morph] = useState(() => useLoginExit.getState().takeArrival() && !reduceMotion);
  const p = useSharedValue(morph ? 0 : 1);

  useEffect(() => {
    if (morph) p.value = withTiming(1, { duration: MORPH_IN_MS, easing: Easing.inOut(Easing.cubic) });
  }, [morph, p]);

  const style = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: 0.94 + 0.06 * p.value }],
  }));

  return <Animated.View style={[s.fill, style]}>{children}</Animated.View>;
}

const s = StyleSheet.create({ fill: { flex: 1 } });
