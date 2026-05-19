import React from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { COLORS, RADIUS } from "@/constants/theme";

export function Field({
  label,
  help,
  children,
  style,
}: {
  label?: string;
  help?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[s.field, style]}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      {children}
      {help ? <Text style={s.help}>{help}</Text> : null}
    </View>
  );
}

export function FieldRow({ children }: { children: React.ReactNode }) {
  return <View style={s.row}>{children}</View>;
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={COLORS.textSubtle}
      {...props}
      style={[s.input, props.style]}
    />
  );
}

export function Textarea(props: TextInputProps) {
  return (
    <TextInput
      multiline
      placeholderTextColor={COLORS.textSubtle}
      {...props}
      style={[s.input, { minHeight: 64, textAlignVertical: "top" }, props.style]}
    />
  );
}

const s = StyleSheet.create({
  field: { marginBottom: 12 },
  row: { flexDirection: "row", gap: 8, marginBottom: 0 },
  label: {
    fontSize: 11, color: COLORS.textMuted,
    marginBottom: 5,
  },
  help: { fontSize: 10, color: COLORS.textSubtle, marginTop: 4, lineHeight: 14 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
    color: COLORS.text,
    backgroundColor: COLORS.bg,
  },
});
