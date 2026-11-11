import React, { useEffect, useMemo, useRef } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

import { font } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** How long the tick stays before it closes itself. */
export const SUCCESS_TICK_MS = 1500;

const SIZE = 96;
const R = 42;
const RING = 2 * Math.PI * R;
const TICK = "M28 50 L43 65 L70 36";
// Length of the tick's two strokes (15·√2 + √(27² + 29²)), rounded up.
const TICK_LEN = 62;

/**
 * "Saved" for a record screen: a ring and a check-mark that draw in, in the
 * theme's ink (black on light, white on dark), and one line under it. Closes
 * itself after SUCCESS_TICK_MS, or on a tap, and calls `onDone` once either
 * way — the screen clears its form there. With reduce-motion on, the tick is
 * shown drawn, without the animation, and still closes on time.
 */
export function SuccessTick({
  visible,
  message,
  onDone,
  duration = SUCCESS_TICK_MS,
}: {
  visible: boolean;
  message: string;
  onDone: () => void;
  duration?: number;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const reduce = useReducedMotion();
  const ring = useSharedValue(0);
  const tick = useSharedValue(0);
  const scale = useSharedValue(1);
  const done = useRef(false);
  const doneCb = useRef(onDone);
  doneCb.current = onDone;

  const finish = () => {
    if (done.current) return;
    done.current = true;
    doneCb.current();
  };

  useEffect(() => {
    if (!visible) return;
    done.current = false;
    if (reduce) {
      ring.value = 1;
      tick.value = 1;
      scale.value = 1;
    } else {
      ring.value = 0;
      tick.value = 0;
      scale.value = 0.6;
      scale.value = withSpring(1, { damping: 12, stiffness: 180 });
      ring.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) });
      tick.value = withDelay(260, withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }));
    }
    const t = setTimeout(finish, duration);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduce, duration]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: RING * (1 - ring.value) }));
  const tickProps = useAnimatedProps(() => ({ strokeDashoffset: TICK_LEN * (1 - tick.value) }));
  const badge = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={finish}>
      <Pressable style={s.scrim} onPress={finish} accessibilityRole="button" accessibilityLabel={`${message}. Tap to continue.`}>
        <View style={s.card} accessibilityLiveRegion="polite">
          <Animated.View style={badge} testID="success-tick">
            <Svg width={SIZE} height={SIZE} viewBox="0 0 100 100">
              <AnimatedCircle
                cx={50}
                cy={50}
                r={R}
                fill="none"
                stroke={c.text}
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray={RING}
                animatedProps={ringProps}
                transform="rotate(-90 50 50)"
              />
              <AnimatedPath
                d={TICK}
                fill="none"
                stroke={c.text}
                strokeWidth={7}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={TICK_LEN}
                animatedProps={tickProps}
              />
            </Svg>
          </Animated.View>
          <Text style={s.msg}>{message}</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    scrim: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 28,
    },
    card: {
      width: "100%",
      maxWidth: 320,
      backgroundColor: c.bg,
      borderRadius: 26,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderSubtle,
      paddingVertical: 28,
      paddingHorizontal: 22,
      alignItems: "center",
      gap: 14,
    },
    msg: { fontSize: 15, ...font("600"), color: c.text, textAlign: "center", lineHeight: 21 },
  });
