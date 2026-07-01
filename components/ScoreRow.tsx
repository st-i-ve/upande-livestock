import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/src/hooks/useColors";

export type ScoreOption = { label: string; tone?: "default" | "success" | "warning" | "danger" };

export function ScoreRow({
  label,
  options,
  defaultIndex = 0,
}: {
  label: string;
  options: ScoreOption[];
  defaultIndex?: number;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  // Monochrome: active state = black border + black text. Danger keeps red.
  const TONES = {
    default: { activeFg: c.text,    activeBorder: c.text },
    success: { activeFg: c.text,    activeBorder: c.text },
    warning: { activeFg: c.warning, activeBorder: c.warning },
    danger:  { activeFg: c.danger,  activeBorder: c.danger },
  };
  const [active, setActive] = useState(defaultIndex);
  return (
    <View style={s.row}>
      <Text style={s.lbl}>{label}</Text>
      <View style={s.opts}>
        {options.map((o, i) => {
          const tone = TONES[o.tone || "default"];
          const isActive = i === active;
          return (
            <Pressable
              key={i}
              onPress={() => setActive(i)}
              style={[
                s.opt,
                isActive && { borderColor: tone.activeBorder, borderWidth: 1 },
              ]}
            >
              <Text style={[s.optText, isActive && { color: tone.activeFg, fontWeight: "600" }]}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 11 },
    lbl: { fontSize: 11, color: c.textMuted, width: 80 },
    opts: { flex: 1, flexDirection: "row", gap: 4 },
    opt: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderSubtle,
      backgroundColor: c.bgMuted,
      alignItems: "center",
    },
    optText: { fontSize: 11, color: c.textMuted },
  });
