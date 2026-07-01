import React, { useMemo } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";

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
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={[s.field, style]}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      {children}
      {help ? <Text style={s.help}>{help}</Text> : null}
    </View>
  );
}

export function FieldRow({ children }: { children: React.ReactNode }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return <View style={s.row}>{children}</View>;
}

export function Input(props: TextInputProps) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <TextInput
      placeholderTextColor={c.textSubtle}
      {...props}
      style={[s.input, props.style]}
    />
  );
}

export function Textarea(props: TextInputProps) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <TextInput
      multiline
      placeholderTextColor={c.textSubtle}
      {...props}
      style={[s.input, { minHeight: 64, textAlignVertical: "top" }, props.style]}
    />
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    field: { marginBottom: 12 },
    row: { flexDirection: "row", gap: 8, marginBottom: 0 },
    label: {
      fontSize: 11, color: c.textMuted,
      marginBottom: 5,
    },
    help: { fontSize: 10, color: c.textSubtle, marginTop: 4, lineHeight: 14 },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: RADIUS.md,
      paddingHorizontal: 10,
      paddingVertical: 9,
      fontSize: 13,
      color: c.text,
      backgroundColor: c.bg,
    },
  });
