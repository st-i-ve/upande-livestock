import { useIsFocused } from "expo-router";
import React, { useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { useSyncParts } from "@/src/sync/useSyncParts";
import { FONT_FAMILY } from "@/constants/theme";
import { syncAnimalsSoon } from "@/src/db/sync";
import { useColors } from "@/src/hooks/useColors";
import { useNetworkStatus } from "@/src/hooks/useNetworkStatus";
import { useLiveStore } from "@/src/realtime/liveStore";
import { retryRealtime } from "@/src/realtime/realtime";
import {
  DOT_BODY,
  DOT_COLOR,
  DOT_PULSES,
  DOT_TITLE,
  dotState,
  lastSyncedText,
  syncText,
  type DotState,
} from "@/src/sync/syncStatus";
import { useSyncStore } from "@/src/sync/syncStore";
import { DotSceneContext, useDotAnchor } from "@/src/sync/dotAnchor";

const DOT = 8;
const HIT = 32;

/** The phone's connection as one state: network, the live link, and any sync. */
export function useDotState(): DotState {
  const online = useNetworkStatus();
  const live = useLiveStore((s) => s.status);
  const syncing = useSyncParts().length > 0;
  return dotState({ online, live, syncing });
}

/** The dot itself: SCP's glowing status light (a ring that swells and fades). */
export function StatusLight({ state }: { state: DotState }) {
  const reduceMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;
  const glowing = DOT_PULSES[state] && !reduceMotion;
  const color = DOT_COLOR[state];

  useEffect(() => {
    if (!glowing) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glowing, pulse]);

  return (
    <View style={s.lightBox}>
      {glowing ? (
        <Animated.View
          style={[
            s.light,
            s.ring,
            {
              backgroundColor: color,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
            },
          ]}
        />
      ) : null}
      <View style={[s.light, { backgroundColor: color }]} />
    </View>
  );
}

/**
 * Top right of each tab's first screen: green and glowing when online and live,
 * amber while syncing (glowing) or while the live link comes up (steady), red
 * offline. A tap opens a small sheet saying what it means, with "Sync now".
 *
 * Inside the tabs this is only an empty slot: the dot itself is drawn once,
 * above every page, by FloatingOnlineDot, so it does not slide away with a
 * swipe and its glow never restarts — it glides to the next page's slot.
 */
export function OnlineDot() {
  const scene = useContext(DotSceneContext);
  return scene ? <DotSlot scene={scene} /> : <PlainOnlineDot />;
}

function PlainOnlineDot() {
  const state = useDotState();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        testID="online-dot"
        onPress={() => setOpen(true)}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`Connection: ${DOT_TITLE[state]}`}
        style={s.hit}
      >
        <StatusLight state={state} />
      </Pressable>
      {open ? <StatusSheet state={state} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function DotSlot({ scene }: { scene: React.RefObject<React.ComponentRef<typeof View> | null> }) {
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const id = useId();
  const focused = useIsFocused();

  const measure = useCallback(() => {
    const node = ref.current;
    const root = scene.current;
    if (!node || !root) return;
    node.measureLayout(
      root,
      (x, y, w, h) => useDotAnchor.getState().claim({ owner: id, x: x + w / 2, y: y + h / 2 }),
      () => {},
    );
  }, [scene, id]);

  useEffect(() => {
    if (!focused) {
      useDotAnchor.getState().release(id);
      return undefined;
    }
    measure();
    return () => useDotAnchor.getState().release(id);
  }, [focused, measure, id]);

  return <View ref={ref} style={s.hit} onLayout={focused ? measure : undefined} />;
}

const GLIDE = { duration: 380, easing: Easing.inOut(Easing.cubic) };
const FADE = { duration: 260, easing: Easing.inOut(Easing.cubic) };

/**
 * The one dot, drawn over the tab pages (put it in a tabs layout). It sits on
 * the focused page's slot, glides when the next page's slot is elsewhere, and
 * fades out on pages without one (a pushed animal page, a record form).
 */
export function FloatingOnlineDot() {
  const anchor = useDotAnchor((x) => x.anchor);
  const state = useDotState();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const shown = useSharedValue(0);

  useEffect(() => {
    if (!anchor) {
      // A beat before hiding: on a swipe the old page can let go just before
      // the new one takes it, and the dot should not blink out between them.
      shown.value = withDelay(180, withTiming(0, FADE));
      return;
    }
    if (reduceMotion || shown.value < 0.05) {
      x.value = anchor.x;
      y.value = anchor.y;
    } else {
      x.value = withTiming(anchor.x, GLIDE);
      y.value = withTiming(anchor.y, GLIDE);
    }
    shown.value = withTiming(1, FADE);
  }, [anchor, reduceMotion, shown, x, y]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [
      { translateX: x.value - HIT / 2 },
      { translateY: y.value - HIT / 2 },
      { scale: 0.6 + 0.4 * shown.value },
    ],
  }));

  return (
    <>
      <Reanimated.View style={[s.floating, style]} pointerEvents={anchor ? "box-none" : "none"}>
        <Pressable
          testID="online-dot"
          onPress={() => setOpen(true)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Connection: ${DOT_TITLE[state]}`}
          style={s.hit}
        >
          <StatusLight state={state} />
        </Pressable>
      </Reanimated.View>
      {open ? <StatusSheet state={state} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function StatusSheet({ state, onClose }: { state: DotState; onClose: () => void }) {
  const c = useColors();
  const st = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const parts = useSyncParts();
  const syncedAt = useSyncStore((x) => x.animalsSyncedAt);
  const error = useSyncStore((x) => x.animalsError);
  // Re-read the clock every 15 s so "synced 1 min ago" moves while it is open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const syncNow = () => {
    retryRealtime();
    void syncAnimalsSoon();
  };

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable style={st.scrim} onPress={onClose}>
        <Pressable style={[st.sheet, { paddingBottom: 20 + insets.bottom }]} onPress={() => {}}>
          <View style={st.handle} />
          <View style={st.head}>
            <StatusLight state={state} />
            <Text style={st.title}>{DOT_TITLE[state]}</Text>
          </View>
          <Text style={st.body}>{DOT_BODY[state]}</Text>
          {parts.length ? <Text style={st.line}>{syncText(parts)}</Text> : null}
          <Text style={st.line}>{lastSyncedText(syncedAt, now)}</Text>
          {error && state !== "syncing" ? (
            <Text style={[st.line, { color: c.danger }]} numberOfLines={2}>
              Last try did not reach the farm
            </Text>
          ) : null}
          <View style={st.actions}>
            <View style={{ flex: 1 }}>
              <Button label="Close" variant="outline" onPress={onClose} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={state === "syncing" ? "Syncing…" : "Sync now"}
                icon="sync"
                onPress={syncNow}
                disabled={state === "offline" || state === "syncing"}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  floating: { position: "absolute", left: 0, top: 0 },
  hit: { width: HIT, height: HIT, alignItems: "center", justifyContent: "center" },
  lightBox: { width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  light: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  ring: { position: "absolute" },
});

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 20,
      paddingTop: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderSubtle,
    },
    handle: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      marginBottom: 14,
    },
    head: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
    title: { fontSize: 18, fontFamily: FONT_FAMILY.semibold, color: c.text },
    body: { fontSize: 14, fontFamily: FONT_FAMILY.regular, color: c.textMuted, lineHeight: 20, marginBottom: 10 },
    line: { fontSize: 13, fontFamily: FONT_FAMILY.medium, color: c.text, marginBottom: 4, fontVariant: ["tabular-nums"] },
    actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  });
