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
 * The Livestock mark: the white disc with the traced cow standing in her grass
 * (the backend's design/logo/livestock_cow_mark.svg; the grass traced from the
 * farm's grazing cow, a few short blades in front of her hooves). When
 * `animated`, her tail swings a little, out and back twice, slowing as it
 * settles, as on the web (scripts/build_livestock_logo.py LOOP: 0, 7, -2, 5,
 * -1, 0 degrees about the top of the tail over 2.56 s of a 4 s round), and the
 * grass leans with it, 2/7 of the tail's turn (at most 2 degrees) about the
 * middle of its ground. Reduce-motion keeps it still.
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
const [GRASS_X0, GRASS_X1, GRASS_BOTTOM] = LOGO_COW.grassFoot;
const [SWAY_X, SWAY_Y] = toDisc((GRASS_X0 + GRASS_X1) / 2, GRASS_BOTTOM);

const CYCLE_MS = 4000;
const LOOP_MS = 2560;
/** [offset in the loop, degrees]; positive swings the switch out, away from her. */
export const TAIL_SWING: readonly (readonly [number, number])[] = [
  [0, 0], [0.1, 0], [0.26, 7], [0.42, -2], [0.58, 5], [0.74, -1], [0.88, 0], [1, 0],
];
/** The grass's lean, as a share of the tail's turn (web: GRASS_SWAY). */
export const GRASS_SWAY = 2 / 7;

/** One layer of the mark, in the disc's coordinates, placed as the cow is. */
function Layer({ size, fill, d }: { size: number; fill: string; d: readonly string[] }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}>
      <G transform={COW_AT}>
        <G transform={COW_IN_BOX} fill={fill}>
          {d.map((p, i) => (
            <Path key={i} d={p} />
          ))}
        </G>
      </G>
    </Svg>
  );
}

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
  const swayStyle = useAnimatedStyle(() => ({ transform: [{ skewX: `${turn.value * GRASS_SWAY}deg` }] }));
  const swayAt = { transformOrigin: `${(SWAY_X / BOX) * 100}% ${(SWAY_Y / BOX) * 100}%` };

  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel="Upande Livestock">
      <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`} style={StyleSheet.absoluteFill}>
        <Circle cx={344.5} cy={344.5} r={340} fill="#ffffff" stroke="#1c1b19" strokeOpacity={0.3} strokeWidth={7} />
      </Svg>
      {/* Back to front: the grass, her body, her tail (turned about where it leaves the
          rump), and the short blades over her hooves; both grass layers lean about
          the middle of their ground. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, swayAt, swayStyle]}>
        <Layer size={size} fill={GRASS} d={[LOGO_COW.grass]} />
      </Animated.View>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Layer size={size} fill={INK} d={[LOGO_COW.body]} />
      </View>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { transformOrigin: `${(PIVOT_X / BOX) * 100}% ${(PIVOT_Y / BOX) * 100}%` },
          tailStyle,
        ]}
      >
        <Layer size={size} fill={INK} d={[LOGO_COW.tail]} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, swayAt, swayStyle]}>
        <Layer size={size} fill={GRASS} d={[LOGO_COW.grassFront]} />
      </Animated.View>
    </View>
  );
}
