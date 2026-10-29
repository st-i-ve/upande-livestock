import React, { useMemo } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { RADIUS, font } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import type { HeadClass } from "@/src/shoats/api";

/**
 * One whole-number box per head class (ewes/does, rams/bucks, lambs/kids…), with
 * what the ledger holds beside each. Everything is by number, never per animal.
 */
export function ClassCounts({
  classes,
  value,
  onChange,
  showLedger = true,
}: {
  classes: HeadClass[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  showLedger?: boolean;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={s.box}>
      {classes.map((k) => (
        <View key={k.key} style={s.row}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.name}>{k.label}</Text>
            {showLedger ? <Text style={s.meta}>{k.head} on the books</Text> : null}
          </View>
          <TextInput
            testID={`count-${k.key}`}
            accessibilityLabel={`${k.label} head`}
            value={value[k.key] ?? ""}
            onChangeText={(v) => onChange({ ...value, [k.key]: v.replace(/[^0-9]/g, "") })}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={c.textSubtle}
            style={s.cell}
            selectTextOnFocus
          />
        </View>
      ))}
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    box: { backgroundColor: c.bgMuted, borderRadius: RADIUS.md, padding: 4, marginBottom: 12 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderSubtle,
    },
    name: { fontSize: 14, ...font("600"), color: c.text },
    meta: { fontSize: 11, color: c.textMuted, marginTop: 1 },
    cell: {
      width: 84,
      height: 40,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.md,
      backgroundColor: c.bg,
      color: c.text,
      paddingHorizontal: 8,
      textAlign: "right",
      fontSize: 15,
    },
  });
