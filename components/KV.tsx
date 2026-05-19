import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "@/constants/theme";

export function KV({
  k,
  v,
  vColor,
}: {
  k: string;
  v: React.ReactNode;
  vColor?: string;
}) {
  return (
    <View style={s.row}>
      <Text style={s.k}>{k}</Text>
      {typeof v === "string" || typeof v === "number" ? (
        <Text style={[s.v, vColor ? { color: vColor } : null]}>{v}</Text>
      ) : (
        v
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderSubtle,
  },
  k: { color: COLORS.textMuted, fontSize: 12 },
  v: { color: COLORS.text, fontSize: 12, fontWeight: "600", textAlign: "right" },
});
