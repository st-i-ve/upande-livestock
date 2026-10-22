import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Banner } from "@/components/Banner";
import { Pill } from "@/components/Pill";
import { font } from "@/constants/theme";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { useColors } from "@/src/hooks/useColors";
import { useOffline } from "@/components/OnlineOnlyNotice";

type Item = { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; href: string };

const MILKING = "/(tabs)/record/events/milk";

const SECTIONS: { title: string; items: Item[] }[] = [
  { title: "Daily routine", items: [
    { icon: "water", label: "Milk recording", href: "/(tabs)/record/events/milk" },
    { icon: "grain", label: "Animal feeding (TMR)", href: "/(tabs)/record/events/animal-feed" },
  ]},
  { title: "Health & breeding", items: [
    { icon: "magnify", label: "Check up", href: "/(tabs)/record/events/diagnosis" },
    { icon: "medical-bag", label: "Treatment (health file)", href: "/(tabs)/record/events/treatment" },
    { icon: "needle", label: "Vaccination", href: "/(tabs)/record/events/vaccination" },
    { icon: "bug", label: "Deworming", href: "/(tabs)/record/events/deworming" },
    { icon: "fire", label: "Heat detection", href: "/(tabs)/record/events/heat" },
    { icon: "heart", label: "Service / AI", href: "/(tabs)/record/events/service" },
    { icon: "clipboard-check", label: "Pregnancy diagnosis", href: "/(tabs)/record/events/pd" },
    { icon: "baby-bottle-outline", label: "Calving", href: "/(tabs)/record/events/calving" },
  ]},
  { title: "Husbandry", items: [
    { icon: "scale", label: "Weight recording", href: "/(tabs)/record/events/weight" },
    { icon: "arrow-left-right", label: "Movement", href: "/(tabs)/record/events/movement" },
    { icon: "content-cut", label: "Dehorning", href: "/(tabs)/record/events/dehorning" },
    { icon: "tools", label: "Hoof trimming", href: "/(tabs)/record/events/hoof" },
    { icon: "water-off", label: "Drying off", href: "/(tabs)/record/events/dryoff" },
  ]},
  { title: "Stores", items: [
    { icon: "warehouse", label: "Stock (read only)", href: "/(tabs)/record/stock" },
  ]},
];

export default function Record() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const offline = useOffline();
  return (
    <Screen title="Livestock events" subtitle="Pick what you observed or did">
      {offline ? (
        <Banner tone="warning" icon="wifi-off">
          You are offline. Only milking can be recorded without a connection; everything else
          needs one because it moves stock or is checked by the server live.
        </Banner>
      ) : null}
      {SECTIONS.map((sec) => (
        <View key={sec.title}>
          <SectionTitle style={s.section}>{sec.title}</SectionTitle>
          {sec.items.map((it) => {
            const onlineOnly = offline && it.href !== MILKING;
            return (
            <Pressable
              key={it.href + it.label}
              onPress={() => router.push(it.href as any)}
              style={({ pressed }) => [
                s.item,
                onlineOnly && { opacity: 0.55 },
                pressed && { backgroundColor: c.bgMuted },
              ]}
            >
              <MaterialCommunityIcons name={it.icon} size={20} color={c.textMuted} />
              <Text style={s.text}>{it.label}</Text>
              {offline ? (
                <Pill label={onlineOnly ? "online only" : "works offline"} tone={onlineOnly ? "default" : "success"} />
              ) : null}
              <MaterialCommunityIcons name="chevron-right" size={20} color={c.textSubtle} />
            </Pressable>
            );
          })}
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
