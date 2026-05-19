import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS, RADIUS } from "@/constants/theme";

export type ChipTone = "default" | "info" | "success" | "warning" | "danger";

// Monochrome chips: active = black border + black text. Danger = red border +
// red text. All other tones collapse to the neutral active style.
const TONES: Record<ChipTone, { fg: string; border: string }> = {
  default: { fg: COLORS.text,    border: COLORS.text },
  info:    { fg: COLORS.text,    border: COLORS.text },
  success: { fg: COLORS.text,    border: COLORS.text },
  warning: { fg: COLORS.warning, border: COLORS.warning },
  danger:  { fg: COLORS.danger,  border: COLORS.danger },
};

export function Chips({ children }: { children: React.ReactNode }) {
  return <View style={s.chips}>{children}</View>;
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
  const t = TONES[tone];
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.chip,
        active && {
          borderColor: t.border,
          borderWidth: 1,
        },
      ]}
    >
      <Text style={[s.text, active && { color: t.fg, fontWeight: "600" }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: COLORS.bgMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.borderSubtle,
  },
  text: { fontSize: 11, color: COLORS.textMuted },
});
