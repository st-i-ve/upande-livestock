import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { COLORS, RADIUS } from "@/constants/theme";

type Variant = "primary" | "outline" | "danger" | "link";

export function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  style?: ViewStyle;
}) {
  const base = variant === "primary" ? s.primary
    : variant === "outline" ? s.outline
    : variant === "danger" ? s.danger
    : s.link;
  const text = variant === "primary" ? s.primaryText
    : variant === "outline" ? s.outlineText
    : variant === "danger" ? s.dangerText
    : s.linkText;

  return (
    <Pressable
      onPress={loading || disabled ? undefined : onPress}
      style={({ pressed }) => [
        s.btn, base,
        (loading || disabled) && { opacity: 0.5 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      <View style={s.row}>
        {loading ? (
          <ActivityIndicator size="small" color={variant === "primary" || variant === "danger" ? "#fff" : COLORS.text} />
        ) : icon ? (
          <MaterialCommunityIcons name={icon} size={16} color={(variant === "primary" || variant === "danger") ? "#fff" : COLORS.text} />
        ) : null}
        <Text style={text}>{label}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    paddingVertical: 11, paddingHorizontal: 16,
    borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center",
    marginTop: 6,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  primary: { backgroundColor: COLORS.primary },
  primaryText: { color: COLORS.bg, fontSize: 13, fontWeight: "600" },
  outline: { backgroundColor: "transparent", borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border },
  outlineText: { color: COLORS.text, fontSize: 13, fontWeight: "500" },
  danger: { backgroundColor: "#A32D2D" },
  dangerText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  link: { paddingVertical: 6, marginTop: 0 },
  linkText: { color: COLORS.text, fontSize: 12, fontWeight: "600", textDecorationLine: "underline" },
});
