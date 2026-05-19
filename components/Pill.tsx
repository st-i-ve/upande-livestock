import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "@/constants/theme";

type Tone = "default" | "info" | "success" | "warning" | "danger" | "preg" | "heif";

// Monochrome system: pills don't carry meaning through colour. We keep the
// tone API for compatibility, but everything except `danger` collapses to a
// single neutral style.
const TONES: Record<Tone, { bg: string; fg: string; border: string }> = {
  default: { bg: COLORS.bgMuted, fg: COLORS.textMuted, border: COLORS.borderSubtle },
  info:    { bg: COLORS.bgMuted, fg: COLORS.text,      border: COLORS.borderSubtle },
  success: { bg: COLORS.bgMuted, fg: COLORS.text,      border: COLORS.borderSubtle },
  warning: { bg: COLORS.bgMuted, fg: COLORS.warning,   border: COLORS.borderSubtle },
  danger:  { bg: "transparent",  fg: COLORS.danger,    border: COLORS.danger },
  preg:    { bg: COLORS.bgMuted, fg: COLORS.textMuted, border: COLORS.borderSubtle },
  heif:    { bg: COLORS.bgMuted, fg: COLORS.textMuted, border: COLORS.borderSubtle },
};

export function Pill({
  label,
  tone = "default",
  bg,
  fg,
}: {
  label: string;
  tone?: Tone;
  /** Legacy passthrough — ignored unless the screen wants to override. */
  bg?: string;
  fg?: string;
}) {
  const t = TONES[tone];
  return (
    <View style={[s.pill, { backgroundColor: bg ?? t.bg, borderColor: t.border }]}>
      <Text style={[s.text, { color: fg ?? t.fg }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: "flex-start",
  },
  text: { fontSize: 10, fontWeight: "600" },
});
