import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { useColors } from "@/src/hooks/useColors";

// A themed confirmation dialog that matches the app's font and colours (light
// and dark), with small circular accents at each corner. Replaces the OS Alert.
export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <Pressable style={s.scrim} onPress={onCancel}>
        {/* Swallow taps on the card so they don't dismiss via the scrim. */}
        <Pressable style={s.card} onPress={() => {}}>
          <View style={[s.corner, s.tl]} />
          <View style={[s.corner, s.tr]} />
          <View style={[s.corner, s.bl]} />
          <View style={[s.corner, s.br]} />

          <Text style={s.title}>{title}</Text>
          {message ? <Text style={s.message}>{message}</Text> : null}

          <View style={s.actions}>
            <View style={s.action}>
              <Button label={cancelLabel} variant="outline" onPress={onCancel} />
            </View>
            <View style={s.action}>
              <Button
                label={confirmLabel}
                variant={destructive ? "danger" : "primary"}
                onPress={onConfirm}
              />
            </View>
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
      maxWidth: 360,
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
      marginBottom: 8,
    },
    message: {
      fontSize: 14,
      color: c.textMuted,
      lineHeight: 20,
      textAlign: "center",
      marginBottom: 22,
    },
    actions: { flexDirection: "row", gap: 12 },
    action: { flex: 1 },
  });
