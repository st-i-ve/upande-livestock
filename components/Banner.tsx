import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";

type Tone = "info" | "success" | "warning" | "danger";

const ICONS: Record<Tone, keyof typeof MaterialCommunityIcons.glyphMap> = {
  info: "information-outline",
  success: "check-circle-outline",
  warning: "alert-outline",
  danger: "alert-octagon-outline",
};

export function Banner({
  tone = "info",
  icon,
  children,
}: {
  tone?: Tone;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  children: React.ReactNode;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const color =
    tone === "danger" ? c.danger : tone === "warning" ? c.warning : tone === "success" ? c.success : c.info;
  return (
    <View style={[s.box, { backgroundColor: `${color}14` }]}>
      <MaterialCommunityIcons name={icon || ICONS[tone]} size={16} color={color} style={{ marginTop: 1 }} />
      <Text style={s.text}>{children}</Text>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    box: {
      flexDirection: "row",
      gap: 8,
      alignItems: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: RADIUS.sm,
      marginBottom: 12,
    },
    text: { flex: 1, fontSize: 13, lineHeight: 18, color: c.text },
  });
