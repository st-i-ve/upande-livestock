import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useColors } from "@/src/hooks/useColors";

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
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const base = variant === "primary" ? s.primary
    : variant === "outline" ? s.outline
    : variant === "danger" ? s.danger
    : s.link;
  const text = variant === "primary" ? s.primaryText
    : variant === "outline" ? s.outlineText
    : variant === "danger" ? s.dangerText
    : s.linkText;
  const onFill = variant === "primary" ? c.bg : "#fff";

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
          <ActivityIndicator size="small" color={variant === "primary" || variant === "danger" ? onFill : c.text} />
        ) : icon ? (
          <MaterialCommunityIcons name={icon} size={18} color={(variant === "primary" || variant === "danger") ? onFill : c.text} />
        ) : null}
        <Text style={text}>{label}</Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    btn: {
      paddingVertical: 13, paddingHorizontal: 20,
      borderRadius: 999, alignItems: "center", justifyContent: "center",
      marginTop: 6,
    },
    row: { flexDirection: "row", alignItems: "center", gap: 6 },
    primary: { backgroundColor: c.primary },
    primaryText: { color: c.bg, fontSize: 16, fontWeight: "600" },
    outline: { backgroundColor: "transparent", borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    outlineText: { color: c.text, fontSize: 16, fontWeight: "500" },
    danger: { backgroundColor: c.danger },
    dangerText: { color: "#fff", fontSize: 16, fontWeight: "600" },
    link: { paddingVertical: 6, marginTop: 0 },
    linkText: { color: c.text, fontSize: 14, fontWeight: "600", textDecorationLine: "underline" },
  });
