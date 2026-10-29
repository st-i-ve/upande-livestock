import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Banner } from "@/components/Banner";
import { Pill } from "@/components/Pill";
import { font } from "@/constants/theme";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { RECORD_SECTIONS } from "@/src/beef/records";
import { useColors } from "@/src/hooks/useColors";
import { useOffline } from "@/components/OnlineOnlyNotice";

export default function Record() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const offline = useOffline();
  return (
    <Screen title="Livestock events" subtitle="Pick what you observed or did">
      {offline ? (
        <Banner tone="warning" icon="wifi-off">
          You are offline. Recording needs a connection: every entry is checked by the server live.
        </Banner>
      ) : null}
      {RECORD_SECTIONS.map((sec) => (
        <View key={sec.title}>
          <SectionTitle style={s.section}>{sec.title}</SectionTitle>
          {sec.items.map((it) => (
            <Pressable
              key={it.href + it.label}
              onPress={() => router.push(it.href as any)}
              style={({ pressed }) => [s.item, offline && { opacity: 0.55 }, pressed && { backgroundColor: c.bgMuted }]}
            >
              <MaterialCommunityIcons name={it.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={20} color={c.textMuted} />
              <Text style={s.text}>{it.label}</Text>
              {offline ? <Pill label="online only" tone="default" /> : null}
              <MaterialCommunityIcons name="chevron-right" size={20} color={c.textSubtle} />
            </Pressable>
          ))}
        </View>
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
      minHeight: 48,
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderSubtle,
    },
    section: { fontSize: 12, marginTop: 18, marginBottom: 4 },
    text: { flex: 1, fontSize: 16, ...font("600"), color: c.text },
  });
