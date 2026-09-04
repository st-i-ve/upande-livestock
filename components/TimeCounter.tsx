import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";

const DIGIT_H = 38;
const DIGIT_W = 22;
const ROLL_MS = 180;
/** Hold-to-repeat: a pause first so a single tap is never read as a hold, then
 *  fast enough to cross an hour without lifting a thumb. */
const HOLD_DELAY_MS = 350;
const HOLD_EVERY_MS = 90;
const MINUTE_STEP = 5;

const MINUTES_IN_DAY = 24 * 60;

const parse = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return ((h || 0) * 60 + (m || 0) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
};

const format = (total: number) => {
  const t = ((total % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
};

/**
 * One digit that rolls when it changes: the old glyph slides out the way the
 * step is going and the new one arrives from the other side.
 *
 * Both glyphs are always mounted and the pair is held in state, so a step that
 * lands mid-animation restarts cleanly from wherever it was rather than
 * stranding a half-scrolled digit.
 */
function RollingDigit({ digit, dir }: { digit: string; dir: 1 | -1 }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [pair, setPair] = useState({ from: digit, to: digit });
  // 1 = settled on `to`; a step drops it to 0 and eases back up.
  const p = useSharedValue(1);

  useEffect(() => {
    setPair((prev) => (prev.to === digit ? prev : { from: prev.to, to: digit }));
  }, [digit]);

  useEffect(() => {
    if (pair.from === pair.to) return;
    p.value = 0;
    p.value = withTiming(1, { duration: ROLL_MS, easing: Easing.out(Easing.cubic) });
  }, [pair, p]);

  const outgoing = useAnimatedStyle(() => ({
    transform: [{ translateY: -DIGIT_H * dir * p.value }],
    opacity: 1 - p.value,
  }));
  const incoming = useAnimatedStyle(() => ({
    transform: [{ translateY: DIGIT_H * dir * (1 - p.value) }],
    opacity: p.value,
  }));

  return (
    <View style={s.digitCell}>
      <Animated.Text style={[s.digit, s.digitAbs, outgoing]}>{pair.from}</Animated.Text>
      <Animated.Text style={[s.digit, s.digitAbs, incoming]}>{pair.to}</Animated.Text>
    </View>
  );
}

function Stepper({
  icon,
  onStep,
  label,
}: {
  icon: "chevron-up" | "chevron-down";
  onStep: () => void;
  label: string;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const every = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (delay.current) clearTimeout(delay.current);
    if (every.current) clearInterval(every.current);
    delay.current = null;
    every.current = null;
  }, []);

  // Unmounting mid-hold would otherwise leave the interval stepping a value
  // nobody is looking at.
  useEffect(() => stop, [stop]);

  const start = () => {
    onStep();
    delay.current = setTimeout(() => {
      every.current = setInterval(onStep, HOLD_EVERY_MS);
    }, HOLD_DELAY_MS);
  };

  return (
    <Pressable
      onPressIn={start}
      onPressOut={stop}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [s.stepper, pressed && { backgroundColor: c.bgMuted }]}
    >
      <MaterialCommunityIcons name={icon} size={20} color={c.textMuted} />
    </Pressable>
  );
}

/**
 * A 24-hour time counter. Hours step by one, minutes by five, and minutes
 * carry: 55 stepped up rolls to 00 and takes the hour with it, because the
 * whole thing is one running total of minutes rather than two independent
 * fields. Both ends wrap, so there is no dead press at midnight.
 */
export function TimeCounter({
  value,
  onChange,
}: {
  /** `HH:mm`, 24-hour. */
  value: string;
  onChange: (hhmm: string) => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [dir, setDir] = useState<1 | -1>(1);

  const step = (deltaMinutes: number) => {
    setDir(deltaMinutes > 0 ? 1 : -1);
    onChange(format(parse(value) + deltaMinutes));
  };

  const [hh, mm] = value.split(":");
  const hours = (hh ?? "00").padStart(2, "0");
  const minutes = (mm ?? "00").padStart(2, "0");

  return (
    <View style={s.wrap}>
      <View style={s.group}>
        <Stepper icon="chevron-up" label="Hour up" onStep={() => step(60)} />
        <View style={s.digits}>
          <RollingDigit digit={hours[0]} dir={dir} />
          <RollingDigit digit={hours[1]} dir={dir} />
        </View>
        <Stepper icon="chevron-down" label="Hour down" onStep={() => step(-60)} />
        <Text style={s.unit}>hh</Text>
      </View>

      <Text style={s.colon}>:</Text>

      <View style={s.group}>
        <Stepper icon="chevron-up" label="Minutes up" onStep={() => step(MINUTE_STEP)} />
        <View style={s.digits}>
          <RollingDigit digit={minutes[0]} dir={dir} />
          <RollingDigit digit={minutes[1]} dir={dir} />
        </View>
        <Stepper icon="chevron-down" label="Minutes down" onStep={() => step(-MINUTE_STEP)} />
        <Text style={s.unit}>mm</Text>
      </View>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 4,
    },
    group: { alignItems: "center" },
    stepper: {
      width: 44,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: RADIUS.md,
    },
    digits: {
      flexDirection: "row",
      // The cells clip the glyphs, so a digit rolling in or out is hidden until
      // it reaches the window — which is what makes it read as a wheel behind a
      // slot rather than text sliding around.
      overflow: "hidden",
      height: DIGIT_H,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: RADIUS.md,
      backgroundColor: c.bg,
      paddingHorizontal: 6,
    },
    digitCell: {
      width: DIGIT_W,
      height: DIGIT_H,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
    },
    digitAbs: { position: "absolute" },
    digit: {
      fontSize: 24,
      lineHeight: DIGIT_H,
      color: c.text,
      textAlign: "center",
      // Tabular-ish: fixed cell width already holds the column, but a variable
      // glyph width would still shift the digit inside it.
      width: DIGIT_W,
      fontVariant: ["tabular-nums"],
    },
    colon: {
      fontSize: 24,
      lineHeight: DIGIT_H,
      color: c.textMuted,
      marginHorizontal: 2,
      // Matches the digit block's own offset so the colon sits on its centre
      // line rather than the group's, which includes the steppers and label.
      marginBottom: 16,
    },
    unit: {
      fontSize: 11,
      color: c.textSubtle,
      marginTop: 2,
    },
  });
