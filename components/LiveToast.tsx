import { useSegments } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FONT_FAMILY } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { useLiveStore } from "@/src/realtime/liveStore";

const SHOW_MS = 2200;

/**
 * A small, non-blocking "Updated just now" that fades in over the Animals list
 * when something new arrives from the farm, then away. The data has already
 * been applied by then; this only says so. It never takes a touch.
 */
export function LiveToast() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const segments = useSegments() as string[];
  const seq = useLiveStore((s) => s.updateSeq);
  const [opacity] = useState(() => new Animated.Value(0));
  const lastSeq = useRef(seq);
  const onAnimals = segments[1] === "animals";

  useEffect(() => {
    if (seq === lastSeq.current) return;
    lastSeq.current = seq;
    if (!onAnimals) return;
    opacity.stopAnimation();
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(SHOW_MS),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [seq, onAnimals, opacity]);

  if (!onAnimals) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[s.wrap, { top: insets.top + 8, opacity, backgroundColor: c.text }]}
    >
      <Text style={[s.text, { color: c.bg }]}>Updated just now</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  text: { fontSize: 12, fontFamily: FONT_FAMILY.medium },
});
