import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";

export function Calc({ label, value, footer }: { label: string; value: string; footer?: string }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={s.box}>
      <Text style={s.lbl}>{label}</Text>
      <Text style={s.num}>{value}</Text>
      {footer ? <Text style={s.f}>{footer}</Text> : null}
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    box: {
      backgroundColor: c.bgMuted,
      borderRadius: RADIUS.md,
      paddingHorizontal: 13,
      paddingVertical: 11,
      marginBottom: 13,
    },
    lbl: { color: c.textMuted, fontSize: 11 },
    num: { color: c.text, fontSize: 20, fontWeight: "700", marginVertical: 2, fontVariant: ["tabular-nums"] },
    f: { color: c.textMuted, fontSize: 11, marginTop: 4 },
  });
