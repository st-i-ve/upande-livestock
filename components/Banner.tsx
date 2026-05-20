import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS, RADIUS } from "@/constants/theme";

type Tone = "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, { color: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = {
  info:    { color: COLORS.info,    icon: "information-outline" },
  success: { color: COLORS.success, icon: "check-circle-outline" },
  warning: { color: COLORS.warning, icon: "alert-outline" },
  danger:  { color: COLORS.danger,  icon: "alert-octagon-outline" },
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
  const t = TONES[tone];
  return (
    <View style={[s.box, { backgroundColor: `${t.color}14` }]}>
      <MaterialCommunityIcons name={icon || t.icon} size={16} color={t.color} style={{ marginTop: 1 }} />
      <Text style={s.text}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    marginBottom: 12,
  },
  text: { flex: 1, fontSize: 13, lineHeight: 18, color: COLORS.text },
});
