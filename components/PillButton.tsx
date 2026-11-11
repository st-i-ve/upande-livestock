import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, type ViewStyle } from "react-native";

import { font } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";

export type PillVariant = "primary" | "secondary" | "destructive";

/**
 * A fully rounded button. primary: filled in the text colour (black on light,
 * white on dark); secondary: the muted surface with a hairline; destructive:
 * the red. Used by the Accessibility modal and the app's alerts.
 */
export function PillButton({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  style,
  testID,
}: {
  label: string;
  onPress?: () => void;
  variant?: PillVariant;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const fg = variant === "primary" ? c.bg : variant === "destructive" ? "#fff" : c.text;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={({ pressed }) => [
        s.btn,
        s[variant],
        disabled && { opacity: 0.5 },
        pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={18} color={fg} /> : null}
      <Text style={[s.label, { color: fg }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    btn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      minHeight: 46,
      paddingVertical: 11,
      paddingHorizontal: 20,
      borderRadius: 999,
    },
    primary: { backgroundColor: c.text },
    secondary: { backgroundColor: c.bgMuted, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    destructive: { backgroundColor: c.danger },
    label: { fontSize: 15, ...font("600"), textAlign: "center", flexShrink: 1 },
  });
