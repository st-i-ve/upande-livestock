import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "@/constants/theme";
import type { Animal } from "@/types";
import { avatarToneFor, initials, pillFor } from "@/services/utils";

import { Avatar } from "./Avatar";
import { Pill } from "./Pill";
import { Row } from "./Row";

export function AnimalRow({ a, onPress, meta }: { a: Animal; onPress?: () => void; meta?: string }) {
  const p = pillFor(a);
  return (
    <Row
      left={<Avatar text={initials(a.name)} tone={avatarToneFor(a)} />}
      title={
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
          <Text style={s.name}>{a.name}</Text>
          <Text style={s.id}>{a.id}</Text>
        </View>
      }
      meta={meta ?? `${a.herd} · ${a.lastWt} kg`}
      right={p ? <Pill label={p.label} tone={p.tone} /> : undefined}
      onPress={onPress}
    />
  );
}

const s = StyleSheet.create({
  name: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  id: { fontSize: 11, color: COLORS.textSubtle, fontFamily: "monospace" },
});
