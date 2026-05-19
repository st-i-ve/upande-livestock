import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "@/constants/theme";

export function Empty({
  icon = "magnify-close",
  text,
}: {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  text: string;
}) {
  return (
    <View style={s.box}>
      <MaterialCommunityIcons name={icon} size={32} color={COLORS.textSubtle} />
      <Text style={s.t}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: { alignItems: "center", paddingVertical: 24, gap: 8 },
  t: { color: COLORS.textSubtle, fontSize: 12 },
});
