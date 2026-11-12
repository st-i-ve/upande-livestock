import { useIsFocused } from "expo-router";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Animated, BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import Reanimated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
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
import { useDotAnchor } from "@/src/sync/dotAnchor";
import { useStatusSheet } from "@/src/sync/statusSheet";
import { useScheme } from "@/src/theme/themeStore";
import { ProgressiveBlur } from "@/components/BlurBackdrop";

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

  // The colour changes (green to amber while syncing, and back) blend over
  // 400 ms in place, rather than switching.
  const tone = useSharedValue(color);
  useEffect(() => {
    tone.value = reduceMotion ? color : withTiming(color, { duration: 400, easing: Easing.inOut(Easing.cubic) });
  }, [color, reduceMotion, tone]);
  const toneStyle = useAnimatedStyle(() => ({ backgroundColor: tone.value }));

  return (
    <View style={s.lightBox}>
      {glowing ? (
        <Animated.View
          style={[
            s.light,
            s.ring,
            {
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
            },
          ]}
        >
          <Reanimated.View style={[s.fillLight, toneStyle]} />
        </Animated.View>
      ) : null}
      <Reanimated.View style={[s.light, toneStyle]} />
    </View>
  );
}

/** Where the dot sits, the same on every tab page: the app bar's top right (its padding, 12 and 10). */
export const DOT_RIGHT = 12;
export const DOT_TOP = 10;

/** True while the dot is drawn over the tabs (FloatingOnlineDot), so headers leave it a slot. */
const FloatingContext = React.createContext(false);

/**
 * Top right of each tab's first screen: green and glowing when online and live,
 * amber while syncing (glowing) or while the live link comes up (steady), red
 * offline. A tap opens a small sheet saying what it means, with "Sync now".
 *
 * Inside the tabs this is only an empty slot: the dot itself is drawn once,
 * above every page and always in the same place, by FloatingOnlineDot, so it
 * never slides with a swipe or shifts between pages, and its glow never
 * restarts; a page only says whether it shows.
 */
export function OnlineDot() {
  const floating = React.useContext(FloatingContext);
  return floating ? <DotSlot /> : <PlainOnlineDot />;
}

function PlainOnlineDot() {
  const state = useDotState();
  return (
    <>
      <Pressable
        testID="online-dot"
        onPress={() => useStatusSheet.getState().show()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`Connection: ${DOT_TITLE[state]}`}
        style={s.hit}
      >
        <StatusLight state={state} />
      </Pressable>
    </>
  );
}

function DotSlot() {
  const id = useId();
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) {
      useDotAnchor.getState().release(id);
      return undefined;
    }
    useDotAnchor.getState().claim(id);
    return () => useDotAnchor.getState().release(id);
  }, [focused, id]);
  // Top aligned, so a taller header (a subtitle) keeps the title beside the dot.
  return <View style={[s.hit, s.slot]} />;
}

const FADE = { duration: 260, easing: Easing.inOut(Easing.cubic) };

/**
 * The one dot, drawn over the tab pages (wrap the tabs layout in it). It sits
 * at the app bar's top right on every page, fixed, and fades out on pages
 * without a slot (a pushed animal page, a record form).
 */
export function FloatingOnlineDot({ children }: { children: React.ReactNode }) {
  const shownBy = useDotAnchor((x) => x.owner);
  const state = useDotState();
  const insets = useSafeAreaInsets();
  const shown = useSharedValue(0);

  useEffect(() => {
    // A beat before hiding: on a swipe the old page can let go just before the
    // new one takes it, and the dot should not blink out between them.
    shown.value = shownBy ? withTiming(1, FADE) : withDelay(180, withTiming(0, FADE));
  }, [shownBy, shown]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ scale: 0.6 + 0.4 * shown.value }],
  }));

  return (
    <FloatingContext.Provider value>
      {children}
      <Reanimated.View
        style={[s.floating, { top: insets.top + DOT_TOP, right: DOT_RIGHT + insets.right }, style]}
        pointerEvents={shownBy ? "box-none" : "none"}
      >
        <Pressable
          testID="online-dot"
          onPress={() => useStatusSheet.getState().show()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Connection: ${DOT_TITLE[state]}`}
          style={s.hit}
        >
          <StatusLight state={state} />
        </Pressable>
      </Reanimated.View>
    </FloatingContext.Provider>
  );
}

/**
 * The connection sheet, drawn once over the whole app (the root layout puts it
 * beside the app's content, outside the blur target): the page behind it blurs,
 * most behind the sheet and fading out towards the top, and the sheet slides up.
 * A tap on the backdrop or the back button closes it.
 */
export function StatusSheetHost() {
  const open = useStatusSheet((x) => x.open);
  const hide = useStatusSheet((x) => x.hide);
  const state = useDotState();
  const dark = useScheme() === "dark";
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      hide();
      return true;
    });
    return () => sub.remove();
  }, [open, hide]);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {open ? (
        <Reanimated.View
          entering={reduce ? undefined : FadeIn.duration(260)}
          exiting={reduce ? undefined : FadeOut.duration(220)}
          style={StyleSheet.absoluteFill}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={hide} accessibilityLabel="Close">
            <ProgressiveBlur dark={dark} />
          </Pressable>
        </Reanimated.View>
      ) : null}
      {open ? (
        <Reanimated.View
          entering={reduce ? undefined : SlideInDown.duration(300).easing(Easing.out(Easing.cubic))}
          exiting={reduce ? undefined : SlideOutDown.duration(240).easing(Easing.in(Easing.cubic))}
          style={s.sheetAt}
        >
          <StatusSheet state={state} onClose={hide} />
        </Reanimated.View>
      ) : null}
    </View>
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
    <View style={[st.sheet, { paddingBottom: 20 + insets.bottom }]}>
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
    </View>
  );
}

const s = StyleSheet.create({
  floating: { position: "absolute" },
  slot: { alignSelf: "flex-start" },
  sheetAt: { position: "absolute", left: 0, right: 0, bottom: 0 },
  hit: { width: HIT, height: HIT, alignItems: "center", justifyContent: "center" },
  lightBox: { width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  light: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  ring: { position: "absolute", overflow: "hidden" },
  fillLight: { flex: 1 },
});

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
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
