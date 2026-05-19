import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS, RADIUS } from "@/constants/theme";

export type Metric = { label: string; value: string | number; sub?: string; color?: string; small?: boolean };

export function MetricGrid({ items }: { items: Metric[] }) {
  return (
    <View style={s.grid}>
      {items.map((m, i) => (
        <View key={i} style={s.cell}>
          <Text style={s.label}>{m.label}</Text>
          <Text style={[s.value, m.small && { fontSize: 14 }, m.color ? { color: m.color } : null]}>{m.value}</Text>
          {m.sub ? <Text style={s.sub}>{m.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginBottom: 12 },
  cell: {
    width: "50%",
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  label: { fontSize: 11, color: COLORS.textMuted },
  value: {
    fontSize: 22, fontWeight: "700", color: COLORS.text,
    marginTop: 2, fontVariant: ["tabular-nums"],
    backgroundColor: COLORS.bgMuted, padding: 10, borderRadius: RADIUS.md, overflow: "hidden",
  },
  sub: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
});
