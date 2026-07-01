import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/src/hooks/useColors";

export function TileGrid({ children }: { children: React.ReactNode }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
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
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.tile, pressed && { opacity: 0.7 }]}>
      <MaterialCommunityIcons name={icon} size={20} color={c.text} />
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.sub}>{subtitle}</Text> : null}
    </Pressable>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
    tile: {
      width: "50%",
      minHeight: 88,
      padding: 12,
      gap: 5,
    },
    title: { fontSize: 12, fontWeight: "600", color: c.text, marginTop: 2 },
    sub: { fontSize: 10, color: c.textMuted, marginTop: 2, lineHeight: 14 },
  });
