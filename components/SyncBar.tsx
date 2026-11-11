import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { FONT_FAMILY } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { syncFraction, syncText } from "@/src/sync/syncStatus";
import { partsOf, useSyncStore } from "@/src/sync/syncStore";

/** A sync that finishes within this never shows the bar (the quick delta syncs). */
export const SHOW_AFTER_MS = 300;
/** Once shown, the bar stays at least this long, so it never flickers. */
export const MIN_SHOWN_MS = 600;
/** In and out: height and opacity together. */
const MOVE_MS = 280;
const EASE = Easing.inOut(Easing.cubic);

/** What is syncing now, in the store's parts, as one stable list. */
export function useSyncParts() {
  const parts = useSyncStore((s) => s.parts);
  return useMemo(() => partsOf(parts), [parts]);
}

/**
 * Whether the bar should be up: true only once a sync has lasted SHOW_AFTER_MS,
 * and then for at least MIN_SHOWN_MS, however soon the sync ends.
 */
function useDebouncedBusy(busy: boolean): boolean {
  const [shown, setShown] = useState(false);
  const shownAt = useRef(0);
  useEffect(() => {
    if (busy && !shown) {
      const t = setTimeout(() => {
        shownAt.current = Date.now();
        setShown(true);
      }, SHOW_AFTER_MS);
      return () => clearTimeout(t);
    }
    if (!busy && shown) {
      const t = setTimeout(() => setShown(false), Math.max(0, MIN_SHOWN_MS - (Date.now() - shownAt.current)));
      return () => clearTimeout(t);
    }
    return undefined;
  }, [busy, shown]);
  return shown;
}

/**
 * The syncing bar: a thin line under the header with what is syncing and how
 * far it has got ("Syncing 120 of 480 animals", "Uploading photo 1 of 2"). It
 * opens and closes smoothly (height and opacity, eased), stays mounted while it
 * closes, fills as work is done and slides while the size is unknown. Under
 * reduce motion it only fades, with no height change and no slide.
 */
export function SyncBar() {
  const c = useColors();
  const reduceMotion = useReducedMotion();
  const parts = useSyncParts();
  const busy = parts.length > 0;
  const shown = useDebouncedBusy(busy);
  const [mounted, setMounted] = useState(false);
  // The text and fill last seen while busy, held while the bar closes.
  const [view, setView] = useState({ text: "", fraction: null as number | null });

  useEffect(() => {
    if (busy) setView({ text: syncText(parts), fraction: syncFraction(parts) });
  }, [busy, parts]);

  const open = useSharedValue(0);
  const contentH = useSharedValue(0);
  const fill = useSharedValue(0);
  const slide = useSharedValue(0);
  const trackW = useSharedValue(0);

  // In: mount, then ease open. Out: ease shut, then unmount.
  useEffect(() => {
    if (shown) {
      fill.value = 0;
      setMounted(true);
      open.value = withTiming(1, { duration: MOVE_MS, easing: EASE });
      return undefined;
    }
    open.value = withTiming(0, { duration: MOVE_MS, easing: EASE });
    const t = setTimeout(() => setMounted(false), MOVE_MS + 20);
    return () => clearTimeout(t);
  }, [shown, open, fill]);

  useEffect(() => {
    if (view.fraction === null) return;
    fill.value = reduceMotion ? view.fraction : withTiming(view.fraction, { duration: MOVE_MS, easing: EASE });
  }, [view.fraction, reduceMotion, fill]);

  const sliding = mounted && view.fraction === null && !reduceMotion;
  useEffect(() => {
    if (!sliding) {
      cancelAnimation(slide);
      slide.value = 0;
      return;
    }
    slide.value = 0;
    slide.value = withRepeat(withTiming(1, { duration: 1200, easing: EASE }), -1, false);
  }, [sliding, slide]);

  const wrapStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: open.value }
      : { opacity: open.value, height: contentH.value * open.value },
  );
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const slideStyle = useAnimatedStyle(() => {
    const seg = Math.max(40, trackW.value * 0.3);
    return { width: seg, transform: [{ translateX: -seg + slide.value * (trackW.value + seg) }] };
  });

  if (!mounted) return null;

  return (
    <Animated.View
      testID="sync-bar"
      accessibilityRole="progressbar"
      accessibilityLabel={view.text}
      accessibilityLiveRegion="polite"
      style={[s.clip, wrapStyle]}
    >
      <View
        style={[s.wrap, reduceMotion ? null : s.measured, { backgroundColor: c.bg, borderBottomColor: c.borderSubtle }]}
        onLayout={(e) => {
          contentH.value = e.nativeEvent.layout.height;
        }}
      >
        <Text style={[s.text, { color: c.textMuted }]} numberOfLines={1}>
          {view.text}
        </Text>
        <View
          style={[s.track, { backgroundColor: c.borderSubtle }]}
          onLayout={(e) => {
            trackW.value = e.nativeEvent.layout.width;
          }}
        >
          {view.fraction !== null ? (
            <Animated.View style={[s.fill, { backgroundColor: c.text }, fillStyle]} />
          ) : reduceMotion ? (
            // Size unknown and no motion: a still third of the track says "working".
            <View style={[s.fill, { backgroundColor: c.text, width: "30%", opacity: 0.6 }]} />
          ) : (
            <Animated.View style={[s.fill, { backgroundColor: c.text }, slideStyle]} />
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  // The content is measured at its natural height inside a clipped box the
  // height of which is animated, so the screen below moves with it.
  clip: { overflow: "hidden" },
  // Measured at its natural height while the box around it opens and shuts.
  measured: { position: "absolute", left: 0, right: 0, top: 0 },
  wrap: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { fontSize: 12, fontFamily: FONT_FAMILY.medium, marginBottom: 5, fontVariant: ["tabular-nums"] },
  track: { height: 3, borderRadius: 3, overflow: "hidden" },
  fill: { height: 3, borderRadius: 3 },
});
