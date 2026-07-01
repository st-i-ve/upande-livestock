import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/src/hooks/useColors";

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
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const Comp: any = onPress ? Pressable : View;
  return (
    <Comp onPress={onPress} style={({ pressed }: any) => [s.row, pressed && { opacity: 0.7 }]}>
      {left ? <View style={s.left}>{left}</View> : null}
      <View style={s.main}>
        {typeof title === "string" ? <Text style={s.title} numberOfLines={1}>{title}</Text> : title}
        {meta ? <Text style={s.meta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      {right ? <View style={s.right}>{right}</View> : null}
      {chevron ? <MaterialCommunityIcons name="chevron-right" size={20} color={c.textSubtle} /> : null}
    </Comp>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderSubtle,
    },
    left: {},
    main: { flex: 1, minWidth: 0 },
    right: { marginLeft: "auto" },
    title: { fontSize: 16, fontWeight: "600", color: c.text },
    meta: { fontSize: 13, color: c.textMuted, marginTop: 1 },
  });
