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
    { icon: "water", label: "Milk recording", href: "/(tabs)/record/events/milk" },
    { icon: "baby-bottle-outline", label: "Calf feeding", href: "/(tabs)/record/events/calf-feed" },
    { icon: "grain", label: "Animal feeding (TMR)", href: "/(tabs)/record/events/animal-feed" },
  ]},
  { title: "Health & breeding", items: [
    { icon: "magnify", label: "Diagnosis (random check)", href: "/(tabs)/record/events/diagnosis" },
    { icon: "needle", label: "Vaccination", href: "/(tabs)/record/events/vaccination" },
    { icon: "bug", label: "Deworming", href: "/(tabs)/record/events/deworming" },
    { icon: "fire", label: "Heat detection", href: "/(tabs)/record/events/heat" },
    { icon: "heart", label: "Service / AI", href: "/(tabs)/record/events/service" },
    { icon: "clipboard-check", label: "Pregnancy diagnosis", href: "/(tabs)/record/events/pd" },
    { icon: "baby-bottle-outline", label: "Calving", href: "/(tabs)/record/events/calving" },
    { icon: "stethoscope", label: "New health case", href: "/(tabs)/record/cases/new" },
  ]},
  { title: "Husbandry", items: [
    { icon: "scale", label: "Weight recording", href: "/(tabs)/record/events/weight" },
    { icon: "arrow-left-right", label: "Movement", href: "/(tabs)/record/events/movement" },
    { icon: "content-cut", label: "Dehorning", href: "/(tabs)/record/events/dehorning" },
    { icon: "tools", label: "Hoof trimming", href: "/(tabs)/record/events/hoof" },
    { icon: "water-off", label: "Drying off", href: "/(tabs)/record/events/dryoff" },
  ]},
  { title: "End of life", items: [
    { icon: "cash", label: "Sell animal", href: "/(tabs)/record/sales/new" },
    { icon: "delete-outline", label: "Cull / death", href: "/(tabs)/record/culls/new" },
  ]},
  { title: "Animals", items: [
    { icon: "cow", label: "Add purchased animal", href: "/(tabs)/record/animals/new" },
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
