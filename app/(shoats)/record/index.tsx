import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Banner } from "@/components/Banner";
import { useOffline } from "@/components/OnlineOnlyNotice";
import { Pill } from "@/components/Pill";
import { Screen } from "@/components/Screen";
import { font } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { LABEL, useAnimalType } from "@/src/shoats/animalType";
import { SHOAT_RECORD_ITEMS } from "@/src/shoats/records";

export default function ShoatRecord() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const offline = useOffline();
  const type = useAnimalType((st) => st.type);
  return (
    <Screen title="Shoat events" subtitle={`${type ? LABEL[type] : "Shoats"} · by number, never per animal`}>
      {offline ? (
        <Banner tone="warning" icon="wifi-off">
          You are offline. Recording needs a connection: every entry is checked by the server live.
        </Banner>
      ) : null}
      {SHOAT_RECORD_ITEMS.map((it) => (
        <Pressable
          key={it.href}
          onPress={() => router.push(it.href as any)}
          style={({ pressed }) => [s.item, offline && { opacity: 0.55 }, pressed && { backgroundColor: c.bgMuted }]}
        >
          <MaterialCommunityIcons name={it.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={22} color={c.textMuted} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.text}>{it.label}</Text>
            <Text style={s.blurb}>{it.blurb}</Text>
          </View>
          {offline ? <Pill label="online only" tone="default" /> : null}
          <MaterialCommunityIcons name="chevron-right" size={20} color={c.textSubtle} />
        </Pressable>
      ))}
    </Screen>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    item: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      minHeight: 56,
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderSubtle,
    },
    text: { fontSize: 16, ...font("600"), color: c.text },
    blurb: { fontSize: 12, color: c.textMuted, marginTop: 1 },
  });
