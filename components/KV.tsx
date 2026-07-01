import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/src/hooks/useColors";

export function KV({
  k,
  v,
  vColor,
}: {
  k: string;
  v: React.ReactNode;
  vColor?: string;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
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

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 7,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderSubtle,
    },
    k: { color: c.textMuted, fontSize: 12 },
    v: { color: c.text, fontSize: 12, fontWeight: "600", textAlign: "right" },
  });
