import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { font } from "@/constants/theme";
import type { Chip as ChipValue } from "@/src/frappe/milkQualityRules";
import { useColors } from "@/src/hooks/useColors";

/** Pass / Fail as a word and a mark, never colour alone. */
export function ResultChip({ label, chip }: { label: string; chip: ChipValue }) {
  const c = useColors();
  const s = useMemo(
    () =>
      StyleSheet.create({
        chip: {
          paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
          borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderSubtle,
        },
        chipText: { fontSize: 11, color: c.text },
        chipOff: { fontSize: 11, color: c.textSubtle, paddingVertical: 3 },
      }),
    [c],
  );
  if (!chip) return <Text style={s.chipOff}>{label} —</Text>;
  const bad = chip === "fail";
  return (
    <View style={[s.chip, bad && { borderColor: c.danger }]}>
      <Text style={[s.chipText, bad && { color: c.danger, ...font("700") }]}>
        {bad ? "✕" : chip === "warn" ? "!" : "✓"} {label}
      </Text>
    </View>
  );
}
