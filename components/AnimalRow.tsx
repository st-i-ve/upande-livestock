import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/src/hooks/useColors";
import type { Animal } from "@/types";
import { STAGE_LABELS, pillFor } from "@/services/utils";

import { AnimalImage } from "./AnimalImage";
import { Pill } from "./Pill";
import { Row } from "./Row";

export function AnimalRow({ a, onPress, meta }: { a: Animal; onPress?: () => void; meta?: string }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const p = pillFor(a);
  return (
    <Row
      left={<AnimalImage image={a.image} animal={a} style={{ width: 38, height: 38, borderRadius: 19 }} />}
      title={
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
          <Text style={s.name}>{a.name}</Text>
          <Text style={s.id}>{a.id}</Text>
          {a.stage ? (
            <Text style={s.stage} testID="stage-chip">{STAGE_LABELS[a.stage] ?? a.stage}</Text>
          ) : null}
        </View>
      }
      meta={meta ?? `${a.herd} · ${a.lastWt} kg`}
      right={p ? <Pill label={p.label} tone={p.tone} /> : undefined}
      onPress={onPress}
    />
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    name: { fontSize: 16, fontWeight: "600", color: c.text },
    stage: {
      fontSize: 11, fontWeight: "600", color: c.textSubtle, borderWidth: 1, borderColor: c.border,
      borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, overflow: "hidden",
    },
    id: { fontSize: 13, color: c.textSubtle, fontFamily: "monospace" },
  });
