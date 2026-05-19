import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "@/constants/theme";

export function TileGrid({ children }: { children: React.ReactNode }) {
  return <View style={s.grid}>{children}</View>;
}

export function Tile({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.tile, pressed && { opacity: 0.7 }]}>
      <MaterialCommunityIcons name={icon} size={20} color={COLORS.text} />
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.sub}>{subtitle}</Text> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  tile: {
    width: "50%",
    minHeight: 88,
    padding: 12,
    gap: 5,
  },
  title: { fontSize: 12, fontWeight: "600", color: COLORS.text, marginTop: 2 },
  sub: { fontSize: 10, color: COLORS.textMuted, marginTop: 2, lineHeight: 14 },
});
