import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/src/hooks/useColors";

type Tone = "default" | "info" | "success" | "warning" | "danger" | "preg" | "heif";

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
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  // Monochrome system: pills don't carry meaning through colour. We keep the
  // tone API for compatibility, but everything except `danger` collapses to a
  // single neutral style.
  const TONES: Record<Tone, { bg: string; fg: string; border: string }> = {
    default: { bg: c.bgMuted, fg: c.textMuted, border: c.borderSubtle },
    info:    { bg: c.bgMuted, fg: c.text,      border: c.borderSubtle },
    success: { bg: c.bgMuted, fg: c.text,      border: c.borderSubtle },
    warning: { bg: c.bgMuted, fg: c.warning,   border: c.borderSubtle },
    danger:  { bg: "transparent",  fg: c.danger,    border: c.danger },
    preg:    { bg: c.bgMuted, fg: c.textMuted, border: c.borderSubtle },
    heif:    { bg: c.bgMuted, fg: c.textMuted, border: c.borderSubtle },
  };
  const t = TONES[tone];
  return (
    <View style={[s.pill, { backgroundColor: bg ?? t.bg, borderColor: t.border }]}>
      <Text style={[s.text, { color: fg ?? t.fg }]}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    pill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      alignSelf: "flex-start",
    },
    text: { fontSize: 10, fontWeight: "600" },
  });
