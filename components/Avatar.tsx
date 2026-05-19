import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "@/constants/theme";

export type AvatarTone = "calf" | "bull" | "dry" | "warning" | "danger" | "default";

// Monochrome system: avatars are neutral grey by default. `danger` is the only
// meaningful tone. Other legacy tones map to the same neutral style.
const TONES: Record<AvatarTone, { bg: string; fg: string }> = {
  default: { bg: COLORS.bgMuted, fg: COLORS.text },
  calf:    { bg: COLORS.bgMuted, fg: COLORS.text },
  bull:    { bg: COLORS.bgMuted, fg: COLORS.text },
  dry:     { bg: COLORS.bgMuted, fg: COLORS.textMuted },
  warning: { bg: COLORS.bgMuted, fg: COLORS.warning },
  danger:  { bg: "transparent",  fg: COLORS.danger },
};

export function Avatar({
  text,
  icon,
  tone = "default",
  size = 34,
}: {
  text?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  tone?: AvatarTone;
  size?: number;
}) {
  const t = TONES[tone];
  return (
    <View
      style={[
        styles.av,
        {
          backgroundColor: t.bg,
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: tone === "danger" ? COLORS.danger : COLORS.borderSubtle,
        },
      ]}
    >
      {icon ? (
        <MaterialCommunityIcons name={icon} size={Math.round(size * 0.5)} color={t.fg} />
      ) : (
        <Text style={[styles.txt, { color: t.fg, fontSize: Math.round(size * 0.32) }]}>{text}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  av: { alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth },
  txt: { fontWeight: "600" },
});
