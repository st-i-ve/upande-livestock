import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { COLORS, FONT, RADIUS } from "@/constants/theme";

export function Card({
  title,
  children,
  style,
  flat,
}: {
  title?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
  flat?: boolean;
}) {
  return (
    <View style={[flat ? s.flat : s.card, style]}>
      {title ? <Text style={s.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.borderSubtle,
    padding: 12,
    marginBottom: 12,
  },
  flat: {
    backgroundColor: COLORS.bgMuted,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 12,
  },
  title: { fontSize: FONT.card.size, fontWeight: FONT.card.weight, color: COLORS.text, marginBottom: 8 },
});
