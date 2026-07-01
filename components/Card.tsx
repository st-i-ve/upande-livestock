import React, { useMemo } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { FONT, RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";

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
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={[flat ? s.flat : s.card, style]}>
      {title ? <Text style={s.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.bg,
      borderRadius: RADIUS.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderSubtle,
      padding: 12,
      marginBottom: 12,
    },
    flat: {
      backgroundColor: c.bgMuted,
      borderRadius: RADIUS.md,
      padding: 12,
      marginBottom: 12,
    },
    title: { fontSize: FONT.card.size, fontWeight: FONT.card.weight, color: c.text, marginBottom: 8 },
  });
