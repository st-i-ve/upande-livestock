import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";

export type Metric = { label: string; value: string | number; sub?: string; color?: string; small?: boolean };

export function MetricGrid({ items }: { items: Metric[] }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
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

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginBottom: 12 },
    cell: {
      width: "50%",
      paddingHorizontal: 4,
      marginBottom: 8,
    },
    label: { fontSize: 11, color: c.textMuted },
    value: {
      fontSize: 22, fontWeight: "700", color: c.text,
      marginTop: 2, fontVariant: ["tabular-nums"],
      backgroundColor: c.bgMuted, padding: 10, borderRadius: RADIUS.md, overflow: "hidden",
    },
    sub: { fontSize: 10, color: c.textMuted, marginTop: 2 },
  });
