import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "@/constants/theme";

export type ScoreOption = { label: string; tone?: "default" | "success" | "warning" | "danger" };

// Monochrome: active state = black border + black text. Danger keeps red.
const TONES = {
  default: { activeFg: COLORS.text,    activeBorder: COLORS.text },
  success: { activeFg: COLORS.text,    activeBorder: COLORS.text },
  warning: { activeFg: COLORS.warning, activeBorder: COLORS.warning },
  danger:  { activeFg: COLORS.danger,  activeBorder: COLORS.danger },
};

export function ScoreRow({
  label,
  options,
  defaultIndex = 0,
}: {
  label: string;
  options: ScoreOption[];
  defaultIndex?: number;
}) {
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

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 11 },
  lbl: { fontSize: 11, color: COLORS.textMuted, width: 80 },
  opts: { flex: 1, flexDirection: "row", gap: 4 },
  opt: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.borderSubtle,
    backgroundColor: COLORS.bgMuted,
    alignItems: "center",
  },
  optText: { fontSize: 11, color: COLORS.textMuted },
});
