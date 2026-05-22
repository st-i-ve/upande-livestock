import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS, FONT_FAMILY, RADIUS } from "@/constants/theme";

export function ErrorState({
  text,
  onRetry,
}: {
  text: string;
  onRetry?: () => void;
}) {
  return (
    <View style={s.box}>
      <MaterialCommunityIcons name="alert-circle-outline" size={28} color={COLORS.danger} />
      <Text style={s.title}>Something went wrong</Text>
      <Text style={s.msg} numberOfLines={4}>
        {text}
      </Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [s.btn, pressed && { opacity: 0.7 }]}
        >
          <Text style={s.btnLabel}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
    gap: 8,
  },
  title: {
    fontSize: 13,
    color: COLORS.text,
    fontFamily: FONT_FAMILY.semibold,
  },
  msg: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 16,
  },
  btn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  btnLabel: {
    fontSize: 12,
    color: COLORS.text,
    fontFamily: FONT_FAMILY.medium,
  },
});
