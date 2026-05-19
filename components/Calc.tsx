import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS, RADIUS } from "@/constants/theme";

export function Calc({ label, value, footer }: { label: string; value: string; footer?: string }) {
  return (
    <View style={s.box}>
      <Text style={s.lbl}>{label}</Text>
      <Text style={s.num}>{value}</Text>
      {footer ? <Text style={s.f}>{footer}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    backgroundColor: COLORS.bgMuted,
    borderRadius: RADIUS.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.text,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 13,
  },
  lbl: { color: COLORS.textMuted, fontSize: 11 },
  num: { color: COLORS.text, fontSize: 20, fontWeight: "700", marginVertical: 2, fontVariant: ["tabular-nums"] },
  f: { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },
});
