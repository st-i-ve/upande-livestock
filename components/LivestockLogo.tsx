import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, G, Path } from "react-native-svg";

import { LOGO_COW, LOGO_MOTION, UPANDE_ARROW } from "@/src/art/paths";
import { sample } from "@/src/logo/motion";

/**
 * The Livestock mark: the white disc with the traced cow standing in her grass
 * (the backend's design/logo/livestock_cow_mark.svg; the grass traced from the
 * farm's grazing cow, a few short blades in front of her hooves). When
 * `animated`, her tail swings a little, out and back twice, slowing as it
 * settles, as on the web (scripts/build_livestock_logo.py LOOP: 0, 7, -2, 5,
 * -1, 0 degrees about the top of the tail over 2.56 s of a 4 s round), and the
 * grass leans with it, 2/7 of the tail's turn (at most 2 degrees) about the
 * middle of its ground. Reduce-motion keeps it still.
 *
 * With `scene` it is the desk tile (livestock_logo.svg) instead, driven by the same keyframes
 * (LOGO_MOTION, generated from the backend's design/logo/livestock_motion.json): "upande" is the
 * tile at rest, the Upande arrow on the disc; "in" plays the scene in over 720 ms (the arrow
 * shrinks into the centre, the grass draws across from the left, the cow walks in) and calls
 * `onEntered`; "cow" holds the scene, her tail swinging and the grass swaying; "out" plays it back
 * to the Upande mark (the in, reversed) and calls `onReturned`. Reduce-motion shows the Upande mark
 * and calls the callbacks at once.
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

const CYCLE_MS = LOGO_MOTION.cycleMs;
const LOOP_MS = LOGO_MOTION.loopMs;
/** [offset in the loop, degrees]; positive swings the switch out, away from her (the desk's LOOP). */
export const TAIL_SWING: readonly (readonly [number, number])[] = LOGO_MOTION.tail;
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

export type LogoScene = "upande" | "in" | "cow" | "out";

export function LivestockLogo({
  size = 200,
  animated = false,
  scene,
  onEntered,
  onReturned,
}: {
  size?: number;
  animated?: boolean;
  /** Draw the desk tile and play it (see above); without it, the still cow mark. */
  scene?: LogoScene;
  onEntered?: () => void;
  onReturned?: () => void;
}) {
  const reduce = useReducedMotion();
  if (scene) {
    return <TileLogo size={size} scene={reduce ? "upande" : scene} reduce={!!reduce} onEntered={onEntered} onReturned={onReturned} />;
  }
  return <CowMark size={size} moving={animated && !reduce} />;
}

/** The tail swing and grass sway, looping while `moving`. */
function useRound(moving: boolean) {
  const turn = useSharedValue(0);
  useEffect(() => {
    if (!moving) {
      turn.value = withTiming(0, { duration: 200 });
      return;
    }
    const steps = TAIL_SWING.slice(1).map(([t, deg], i) =>
      withTiming(deg, { duration: (t - TAIL_SWING[i][0]) * LOOP_MS, easing: Easing.inOut(Easing.sin) }),
    );
    turn.value = withRepeat(withSequence(...steps, withDelay(CYCLE_MS - LOOP_MS, withTiming(0, { duration: 0 }))), -1);
    return () => cancelAnimation(turn);
  }, [moving, turn]);
  const tailStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  const swayStyle = useAnimatedStyle(() => ({ transform: [{ skewX: `${turn.value * GRASS_SWAY}deg` }] }));
  return { tailStyle, swayStyle };
}

const pct = (v: number) => `${(v / BOX) * 100}%`;
const SWAY_AT = { transformOrigin: `${pct(SWAY_X)} ${pct(SWAY_Y)}` };
const TAIL_AT = { transformOrigin: `${pct(PIVOT_X)} ${pct(PIVOT_Y)}` };

function CowMark({ size, moving }: { size: number; moving: boolean }) {
  const { tailStyle, swayStyle } = useRound(moving);
  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel="Upande Livestock">
      <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`} style={StyleSheet.absoluteFill}>
        <Circle cx={344.5} cy={344.5} r={340} fill="#ffffff" stroke="#1c1b19" strokeOpacity={0.3} strokeWidth={7} />
      </Svg>
      {/* Back to front: the grass, her body, her tail (turned about where it leaves the
          rump), and the short blades over her hooves; both grass layers lean about
          the middle of their ground. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, SWAY_AT, swayStyle]}>
        <Layer size={size} fill={GRASS} d={[LOGO_COW.grass]} />
      </Animated.View>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Layer size={size} fill={INK} d={[LOGO_COW.body]} />
      </View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, TAIL_AT, tailStyle]}>
        <Layer size={size} fill={INK} d={[LOGO_COW.tail]} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, SWAY_AT, swayStyle]}>
        <Layer size={size} fill={GRASS} d={[LOGO_COW.grassFront]} />
      </Animated.View>
    </View>
  );
}

// The grass's ground, left to right, on the disc: the clip that draws it across uncovers it from
// its left end (web: inset(… right% … -10%), the reveal 0 → 1.1 of its width).
const [GRASS_LEFT] = toDisc(GRASS_X0, GRASS_BOTTOM);
const [GRASS_RIGHT] = toDisc(GRASS_X1, GRASS_BOTTOM);
// The cow group sits inside translate(50 158) scale(1.05): her shift is in those units.
const COW_SCALE = 1.05;
const M = LOGO_MOTION;

/** The tile's still frame at enter progress p (0 = the Upande mark, 1 = the scene): for tests. */
export function tileFrame(p: number) {
  return {
    arrowScale: sample(M.arrowScale, p, M.ease),
    arrowOpacity: sample(M.arrowOpacity, p, M.ease),
    sceneOpacity: sample(M.sceneOpacity, p, M.ease),
    grassReveal: sample(M.grassReveal, p, M.ease),
    cowShift: sample(M.cowShift, p, M.ease) * COW_SCALE,
    cowOpacity: sample(M.cowOpacity, p, M.ease),
  };
}

function TileLogo({
  size,
  scene,
  reduce,
  onEntered,
  onReturned,
}: {
  size: number;
  scene: LogoScene;
  reduce: boolean;
  onEntered?: () => void;
  onReturned?: () => void;
}) {
  // Enter progress: 0 = the Upande mark, 1 = the scene in. "out" runs it back down.
  const p = useSharedValue(scene === "cow" ? 1 : 0);
  const k = size / BOX;
  const cb = useRef({ onEntered, onReturned });
  cb.current = { onEntered, onReturned };
  const entered = () => cb.current.onEntered?.();
  const returned = () => cb.current.onReturned?.();

  useEffect(() => {
    if (reduce) {
      p.value = 0;
      if (scene === "in") entered();
      if (scene === "out") returned();
      return;
    }
    if (scene === "upande") p.value = 0;
    else if (scene === "cow") p.value = 1;
    else if (scene === "in") {
      p.value = withTiming(1, { duration: M.enterMs * (1 - p.value), easing: Easing.linear }, (done) => {
        if (done) runOnJS(entered)();
      });
    } else {
      p.value = withTiming(0, { duration: M.enterMs * p.value, easing: Easing.linear }, (done) => {
        if (done) runOnJS(returned)();
      });
    }
    return () => cancelAnimation(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, reduce]);

  const { tailStyle, swayStyle } = useRound(scene === "cow" && !reduce);

  const arrowStyle = useAnimatedStyle(() => ({
    opacity: sample(M.arrowOpacity, p.value, M.ease),
    transform: [{ scale: sample(M.arrowScale, p.value, M.ease) }],
  }));
  const sceneStyle = useAnimatedStyle(() => ({ opacity: sample(M.sceneOpacity, p.value, M.ease) }));
  const cowStyle = useAnimatedStyle(() => ({
    opacity: sample(M.cowOpacity, p.value, M.ease),
    transform: [{ translateX: sample(M.cowShift, p.value, M.ease) * COW_SCALE * k }],
  }));
  const revealStyle = useAnimatedStyle(() => ({
    width: (GRASS_LEFT + sample(M.grassReveal, p.value, M.ease) * (GRASS_RIGHT - GRASS_LEFT)) * k,
  }));
  const arrowAt = { transformOrigin: `${pct(M.arrowOrigin[0])} ${pct(M.arrowOrigin[1])}` };
  const full = { position: "absolute" as const, left: 0, top: 0, width: size, height: size };

  const grass = (d: string) => (
    <Animated.View pointerEvents="none" style={[full, { overflow: "hidden" }, revealStyle]}>
      <Animated.View style={[full, SWAY_AT, swayStyle]}>
        <Layer size={size} fill={GRASS} d={[d]} />
      </Animated.View>
    </Animated.View>
  );

  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel="Upande Livestock">
      <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`} style={StyleSheet.absoluteFill}>
        <Circle cx={344.5} cy={344.5} r={340} fill="#ffffff" stroke="#1c1b19" strokeOpacity={0.3} strokeWidth={7} />
      </Svg>
      {/* Inside the disc, as the tile clips its scene: back to front the grass, the cow (her
          tail turned about the rump), the blades over her hooves, then the arrow on top. */}
      <View pointerEvents="none" style={[full, { borderRadius: size / 2, overflow: "hidden" }]}>
        <Animated.View style={[full, sceneStyle]}>
          {grass(LOGO_COW.grass)}
          <Animated.View style={[full, cowStyle]}>
            <View style={full}>
              <Layer size={size} fill={INK} d={[LOGO_COW.body]} />
            </View>
            <Animated.View style={[full, TAIL_AT, tailStyle]}>
              <Layer size={size} fill={INK} d={[LOGO_COW.tail]} />
            </Animated.View>
          </Animated.View>
          {grass(LOGO_COW.grassFront)}
        </Animated.View>
        <Animated.View style={[full, arrowAt, arrowStyle]}>
          <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}>
            <G transform={`translate(${UPANDE_ARROW.at[0]} ${UPANDE_ARROW.at[1]})`}>
              {UPANDE_ARROW.paths.map(([fill, d], i) => (
                <Path key={i} fill={fill} d={d} />
              ))}
            </G>
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
}
