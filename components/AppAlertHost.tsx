import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { AccessibilityInfo, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { PillButton, type PillVariant } from "@/components/PillButton";
import { font } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { backAction, useAppAlerts, type AppAlert, type AppAlertButton } from "@/src/ui/alert";

const IN_MS = 220;
const OUT_MS = 160;
const EASE = Easing.inOut(Easing.cubic);

const variantOf = (b: AppAlertButton): PillVariant =>
  b.style === "cancel" ? "secondary" : b.style === "destructive" ? "destructive" : "primary";

/**
 * Draws every `Alert.alert` (see src/ui/alert.ts): rendered once, at the root,
 * over everything. A centred card — title, message, pill buttons (cancel:
 * secondary, destructive: red, default: primary) — over a dimmed backdrop; it
 * eases in and out (scale and fade; reduce motion: fade only). One alert at a
 * time, the rest wait their turn in order.
 */
export function AppAlertHost() {
  const current = useAppAlerts((s) => s.queue[0] ?? null);
  const shift = useAppAlerts((s) => s.shift);
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const closing = useRef<number | null>(null);

  useEffect(() => {
    if (!current) return;
    closing.current = null;
    progress.value = 0;
    progress.value = withTiming(1, { duration: reduceMotion ? 150 : IN_MS, easing: EASE });
  }, [current, progress, reduceMotion]);

  /** Ease out, take it off the queue, then run what the user chose. */
  const close = useCallback(
    (a: AppAlert, then?: () => void) => {
      if (closing.current === a.id) return;
      closing.current = a.id;
      progress.value = withTiming(0, { duration: OUT_MS, easing: EASE });
      setTimeout(() => {
        shift(a.id);
        then?.();
      }, OUT_MS);
    },
    [progress, shift],
  );

  const press = useCallback((a: AppAlert, b: AppAlertButton) => close(a, b.onPress ? () => b.onPress?.() : undefined), [close]);
  const dismiss = useCallback((a: AppAlert) => close(a, a.options.onDismiss), [close]);

  const onBack = useCallback(() => {
    if (!current) return;
    const act = backAction(current);
    if (act === "dismiss") dismiss(current);
    else if (act) press(current, act);
  }, [current, dismiss, press]);

  const backdrop = useAnimatedStyle(() => ({ opacity: progress.value }));
  const card = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: progress.value }
      : { opacity: progress.value, transform: [{ scale: 0.92 + 0.08 * progress.value }] },
  );

  if (!current) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onBack}
    >
      <View style={s.fill}>
        <Animated.View style={[s.fill, s.dim, backdrop]}>
          <Pressable
            style={s.fill}
            onPress={current.options.cancelable ? () => dismiss(current) : undefined}
            accessible={false}
            importantForAccessibility="no"
          />
        </Animated.View>
        <View style={s.center} pointerEvents="box-none">
          <Animated.View style={[s.cardWrap, card]}>
            <AlertCard key={current.id} alert={current} onPress={(b) => press(current, b)} />
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

/** The card itself: title, message and the pill buttons. */
export function AlertCard({ alert, onPress }: { alert: AppAlert; onPress: (b: AppAlertButton) => void }) {
  const c = useColors();
  const st = useMemo(() => makeStyles(c), [c]);
  const titleRef = useRef<React.ComponentRef<typeof Text>>(null);
  // Two short labels side by side; three, or long ones that would wrap, stacked.
  const row = alert.buttons.length <= 2 && alert.buttons.every((b) => (b.text ?? "").length <= 14);

  // Screen readers land on the title as the alert opens.
  useEffect(() => {
    const t = setTimeout(() => {
      if (titleRef.current) AccessibilityInfo.sendAccessibilityEvent(titleRef.current, "focus");
    }, 60);
    return () => clearTimeout(t);
  }, []);

  const hasTitle = alert.title.trim() !== "";
  return (
    <View
      testID="app-alert"
      role="alertdialog"
      accessibilityViewIsModal
      aria-modal
      accessibilityLabel={[alert.title, alert.message].filter(Boolean).join(". ")}
      style={st.card}
    >
      {hasTitle ? (
        <Text ref={titleRef} style={st.title} accessibilityRole="header">
          {alert.title}
        </Text>
      ) : null}
      {alert.message ? (
        <Text ref={hasTitle ? undefined : titleRef} style={[st.message, !hasTitle && { marginTop: 0 }]}>
          {alert.message}
        </Text>
      ) : null}
      <View style={[st.actions, row ? st.row : st.column]}>
        {alert.buttons.map((b, i) => (
          <PillButton
            key={`${i}-${b.text}`}
            label={b.text ?? "OK"}
            variant={variantOf(b)}
            onPress={() => onPress(b)}
            testID={`app-alert-button-${i}`}
            style={row ? st.rowBtn : undefined}
          />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  dim: { backgroundColor: "rgba(0,0,0,0.5)" },
  center: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  cardWrap: { width: "100%", maxWidth: 380 },
});

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    card: {
      width: "100%",
      backgroundColor: c.bg,
      borderRadius: 26,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderSubtle,
      paddingHorizontal: 22,
      paddingTop: 24,
      paddingBottom: 20,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    },
    title: { fontSize: 18, ...font("600"), color: c.text, textAlign: "center" },
    message: { fontSize: 14, color: c.textMuted, lineHeight: 20, textAlign: "center", marginTop: 8 },
    actions: { marginTop: 22, gap: 10 },
    row: { flexDirection: "row" },
    column: { flexDirection: "column" },
    rowBtn: { flex: 1 },
  });
