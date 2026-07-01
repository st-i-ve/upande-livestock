import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/src/hooks/useColors";

export function Empty({
  icon = "magnify-close",
  text,
}: {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  text: string;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={s.box}>
      <MaterialCommunityIcons name={icon} size={32} color={c.textSubtle} />
      <Text style={s.t}>{text}</Text>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    box: { alignItems: "center", paddingVertical: 24, gap: 8 },
    t: { color: c.textSubtle, fontSize: 12 },
  });
