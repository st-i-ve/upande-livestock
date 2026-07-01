import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/src/hooks/useColors";

export type ChipTone = "default" | "info" | "success" | "warning" | "danger";

export function Chips({ children }: { children: React.ReactNode }) {
  return <View style={staticStyles.chips}>{children}</View>;
}

export function Chip({
  label,
  active,
  tone = "default",
  onPress,
}: {
  label: string;
  active?: boolean;
  tone?: ChipTone;
  onPress?: () => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  // Monochrome chips: active = coloured border + text. Danger/warning keep
  // their meaning; other tones collapse to the neutral active style.
  const tones: Record<ChipTone, { fg: string; border: string }> = {
    default: { fg: c.text, border: c.text },
    info: { fg: c.text, border: c.text },
    success: { fg: c.text, border: c.text },
    warning: { fg: c.warning, border: c.warning },
    danger: { fg: c.danger, border: c.danger },
  };
  const t = tones[tone];
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, active && { borderColor: t.border, borderWidth: 1 }]}
    >
      <Text style={[s.text, active && { color: t.fg, fontWeight: "600" }]}>{label}</Text>
    </Pressable>
  );
}

const staticStyles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 },
});

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: c.bgMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderSubtle,
    },
    text: { fontSize: 13, color: c.textMuted },
  });
