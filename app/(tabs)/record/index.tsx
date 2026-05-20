import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { COLORS } from "@/constants/theme";

type Item = { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; href: string };

const SECTIONS: { title: string; items: Item[] }[] = [
  { title: "Daily routine", items: [
    { icon: "water", label: "Milk recording", href: "/events/milk" },
    { icon: "baby-bottle-outline", label: "Calf feeding", href: "/events/calf-feed" },
    { icon: "grain", label: "Animal feeding (TMR)", href: "/events/animal-feed" },
  ]},
  { title: "Health & breeding", items: [
    { icon: "magnify", label: "Diagnosis (random check)", href: "/events/diagnosis" },
    { icon: "needle", label: "Vaccination", href: "/events/vaccination" },
    { icon: "bug", label: "Deworming", href: "/events/deworming" },
    { icon: "fire", label: "Heat detection", href: "/events/heat" },
    { icon: "heart", label: "Service / AI", href: "/events/service" },
    { icon: "clipboard-check", label: "Pregnancy diagnosis", href: "/events/pd" },
    { icon: "baby-bottle-outline", label: "Calving", href: "/events/calving" },
    { icon: "stethoscope", label: "New health case", href: "/(tabs)/alerts/cases" },
  ]},
  { title: "Husbandry", items: [
    { icon: "scale", label: "Weight recording", href: "/events/weight" },
    { icon: "arrow-left-right", label: "Movement", href: "/events/movement" },
    { icon: "content-cut", label: "Dehorning", href: "/events/dehorning" },
    { icon: "tools", label: "Hoof trimming", href: "/events/hoof" },
    { icon: "water-off", label: "Drying off", href: "/events/dryoff" },
  ]},
  { title: "End of life", items: [
    { icon: "cash", label: "Sell animal", href: "/sales/new" },
    { icon: "delete-outline", label: "Cull / death", href: "/culls/new" },
  ]},
];

export default function Record() {
  return (
    <Screen title="Record an event" subtitle="Pick what you observed or did">
      {SECTIONS.map((sec) => (
        <View key={sec.title}>
          <SectionTitle>{sec.title}</SectionTitle>
          {sec.items.map((it) => (
            <Pressable
              key={it.href + it.label}
              onPress={() => router.push(it.href as any)}
              style={({ pressed }) => [s.item, pressed && { backgroundColor: COLORS.bgMuted }]}
            >
              <MaterialCommunityIcons name={it.icon} size={18} color={COLORS.textMuted} />
              <Text style={s.text}>{it.label}</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.textSubtle} />
            </Pressable>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderSubtle,
  },
  text: { flex: 1, fontSize: 13, color: COLORS.text },
});
