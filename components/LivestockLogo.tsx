import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, G, Path } from "react-native-svg";

import { LOGO_COW } from "@/src/art/paths";

/**
 * The Livestock mark: the white disc with the traced cow on her strip of grass
 * (the backend's design/logo/livestock_cow_mark.svg). When `animated`, her
 * tail swings a little, out and back twice, slowing as it settles, as on the
 * web (scripts/build_livestock_logo.py LOOP: 0, 7, -2, 5, -1, 0 degrees about
 * the top of the tail over 2.56 s of a 4 s round).
 */
const INK = "#45433f";
const GRASS = "#6a9a4c";
const BOX = 689;
// The mark's placement of the cow: translate(50 158) scale(1.05), then the
// traced canvas into its box: translate(60 40) scale(0.93).
const COW_AT = "translate(50 158) scale(1.05)";
const COW_IN_BOX = "translate(60 40) scale(0.93)";
const toDisc = (x: number, y: number) => [50 + 1.05 * (60 + 0.93 * x), 158 + 1.05 * (40 + 0.93 * y)] as const;
const [PIVOT_X, PIVOT_Y] = toDisc(LOGO_COW.tailHead[0], LOGO_COW.tailHead[1]);

const CYCLE_MS = 4000;
const LOOP_MS = 2560;
/** [offset in the loop, degrees]; positive swings the switch out, away from her. */
export const TAIL_SWING: readonly (readonly [number, number])[] = [
  [0, 0], [0.1, 0], [0.26, 7], [0.42, -2], [0.58, 5], [0.74, -1], [0.88, 0], [1, 0],
];

export function LivestockLogo({ size = 200, animated = false }: { size?: number; animated?: boolean }) {
  const reduce = useReducedMotion();
  const turn = useSharedValue(0);
  const moving = animated && !reduce;

  useEffect(() => {
    if (!moving) return;
    const steps = TAIL_SWING.slice(1).map(([t, deg], i) =>
      withTiming(deg, { duration: (t - TAIL_SWING[i][0]) * LOOP_MS, easing: Easing.inOut(Easing.sin) }),
    );
    turn.value = withRepeat(withSequence(...steps, withDelay(CYCLE_MS - LOOP_MS, withTiming(0, { duration: 0 }))), -1);
    return () => cancelAnimation(turn);
  }, [moving, turn]);

  const tailStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));

  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel="Upande Livestock">
      <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`} style={StyleSheet.absoluteFill}>
        <Circle cx={344.5} cy={344.5} r={340} fill="#ffffff" stroke="#1c1b19" strokeOpacity={0.3} strokeWidth={7} />
        <G transform={COW_AT}>
          <Path d="M30 334 C120 326 420 326 530 334" fill="none" stroke={GRASS} strokeWidth={12} strokeLinecap="round" />
          <G transform={COW_IN_BOX} fill={INK}>
            <Path d={LOGO_COW.body} />
          </G>
        </G>
      </Svg>
      {/* The tail on its own layer, turned about the point where it leaves the rump. */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { transformOrigin: `${(PIVOT_X / BOX) * 100}% ${(PIVOT_Y / BOX) * 100}%` },
          tailStyle,
        ]}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}>
          <G transform={COW_AT}>
            <G transform={COW_IN_BOX} fill={INK}>
              <Path d={LOGO_COW.tail} />
            </G>
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}
