import React, { useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { useColors } from "@/src/hooks/useColors";
import { type AlertButton, useAlertStore } from "@/src/ui/appAlert";

// Root-mounted host for appAlert(): renders the current alert as an app-themed
// modal (matching the logout dialog) with a scrollable message so long/complete
// error logs are never clipped.
export function AppAlertHost() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const current = useAlertStore((st) => st.current);
  const hide = useAlertStore((st) => st.hide);

  if (!current) return null;

  const run = (b: AlertButton) => {
    hide();
    b.onPress?.();
  };

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="fade"
      onRequestClose={hide}
    >
      <Pressable style={s.scrim} onPress={hide}>
        <Pressable style={s.card} onPress={() => {}}>
          <View style={[s.corner, s.tl]} />
          <View style={[s.corner, s.tr]} />
          <View style={[s.corner, s.bl]} />
          <View style={[s.corner, s.br]} />

          <Text style={s.title}>{current.title}</Text>
          {current.message ? (
            <ScrollView style={s.msgWrap} contentContainerStyle={{ paddingVertical: 2 }}>
              <Text style={s.message}>{current.message}</Text>
            </ScrollView>
          ) : null}

          <View style={s.actions}>
            {current.buttons.map((b, i) => (
              <View key={`${b.text}-${i}`} style={s.action}>
                <Button
                  label={b.text}
                  variant={b.style === "destructive" ? "danger" : b.style === "cancel" ? "outline" : "primary"}
                  onPress={() => run(b)}
                />
              </View>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const CORNER = 10;
const INSET = 14;

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    scrim: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 28,
    },
    card: {
      width: "100%",
      maxWidth: 380,
      backgroundColor: c.bg,
      borderRadius: 26,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderSubtle,
      paddingHorizontal: 24,
      paddingVertical: 26,
    },
    corner: {
      position: "absolute",
      width: CORNER,
      height: CORNER,
      borderRadius: CORNER / 2,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.bg,
    },
    tl: { top: INSET, left: INSET },
    tr: { top: INSET, right: INSET },
    bl: { bottom: INSET, left: INSET },
    br: { bottom: INSET, right: INSET },
    title: {
      fontSize: 18,
      fontWeight: "600",
      color: c.text,
      textAlign: "center",
      marginBottom: 10,
    },
    msgWrap: { maxHeight: 320, marginBottom: 20 },
    message: {
      fontSize: 14,
      color: c.textMuted,
      lineHeight: 20,
      textAlign: "center",
    },
    actions: { flexDirection: "row", gap: 12 },
    action: { flex: 1 },
  });
