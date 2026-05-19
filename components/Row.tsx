import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "@/constants/theme";

export function Row({
  left,
  title,
  meta,
  right,
  chevron,
  onPress,
}: {
  left?: React.ReactNode;
  title: React.ReactNode;
  meta?: string;
  right?: React.ReactNode;
  chevron?: boolean;
  onPress?: () => void;
}) {
  const Comp: any = onPress ? Pressable : View;
  return (
    <Comp onPress={onPress} style={({ pressed }: any) => [s.row, pressed && { opacity: 0.7 }]}>
      {left ? <View style={s.left}>{left}</View> : null}
      <View style={s.main}>
        {typeof title === "string" ? <Text style={s.title} numberOfLines={1}>{title}</Text> : title}
        {meta ? <Text style={s.meta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      {right ? <View style={s.right}>{right}</View> : null}
      {chevron ? <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.textSubtle} /> : null}
    </Comp>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderSubtle,
  },
  left: {},
  main: { flex: 1, minWidth: 0 },
  right: { marginLeft: "auto" },
  title: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  meta: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
});
