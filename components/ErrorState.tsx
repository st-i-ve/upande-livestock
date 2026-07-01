import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FONT_FAMILY, RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";

export function ErrorState({
  text,
  onRetry,
}: {
  text: string;
  onRetry?: () => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={s.box}>
      <MaterialCommunityIcons name="alert-circle-outline" size={28} color={c.danger} />
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

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
  box: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
    gap: 8,
  },
  title: {
    fontSize: 13,
    color: c.text,
    fontFamily: FONT_FAMILY.semibold,
  },
  msg: {
    fontSize: 12,
    color: c.textMuted,
    textAlign: "center",
    lineHeight: 16,
  },
  btn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  btnLabel: {
    fontSize: 12,
    color: c.text,
    fontFamily: FONT_FAMILY.medium,
  },
});
