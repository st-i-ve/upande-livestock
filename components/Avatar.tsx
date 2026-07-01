import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/src/hooks/useColors";

export type AvatarTone = "calf" | "bull" | "dry" | "warning" | "danger" | "default";

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
  const c = useColors();
  // Monochrome system: avatars are neutral by default. `danger` is the only
  // meaningful tone. Other legacy tones map to the neutral style.
  const tones: Record<AvatarTone, { bg: string; fg: string }> = {
    default: { bg: c.bgMuted, fg: c.text },
    calf:    { bg: c.bgMuted, fg: c.text },
    bull:    { bg: c.bgMuted, fg: c.text },
    dry:     { bg: c.bgMuted, fg: c.textMuted },
    warning: { bg: c.bgMuted, fg: c.warning },
    danger:  { bg: "transparent", fg: c.danger },
  };
  const t = tones[tone];
  return (
    <View
      style={[
        styles.av,
        {
          backgroundColor: t.bg,
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: tone === "danger" ? c.danger : c.borderSubtle,
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
