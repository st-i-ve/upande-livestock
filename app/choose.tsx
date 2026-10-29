import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/Screen";
import { RADIUS, font } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { homeOf, useAnimalType, type AnimalType } from "@/src/shoats/animalType";

type Option = { id: string; label: string; blurb: string; icon: keyof typeof MaterialCommunityIcons.glyphMap };

const TOP: Option[] = [
  { id: "cattle", label: "Cattle", blurb: "Individual animals: weights, breeding, health, feeding.", icon: "cow" },
  { id: "shoats", label: "Shoats", blurb: "Sheep and goats, kept by herd numbers.", icon: "sheep" },
];
const SHOATS: Option[] = [
  { id: "sheep", label: "Sheep", blurb: "Flocks: ewes, rams, lambs.", icon: "sheep" },
  { id: "goats", label: "Goats", blurb: "Herds: does, bucks, kids.", icon: "sheep" },
];

/**
 * First screen after login, and the target of the switch in Profile and on the
 * Shoats header: Cattle, or Shoats and then Sheep or Goats. The answer is kept on
 * the phone, so the next launch opens straight in.
 */
export default function Choose() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const current = useAnimalType((st) => st.type);
  const setType = useAnimalType((st) => st.setType);
  const [step, setStep] = useState<"top" | "shoats">(current === "sheep" || current === "goats" ? "shoats" : "top");

  const pick = (id: string) => {
    if (id === "shoats") return setStep("shoats");
    const t = id as AnimalType;
    setType(t);
    router.replace(homeOf(t));
  };
  const options = step === "top" ? TOP : SHOATS;
  const selected = (id: string) => id === current || (id === "shoats" && (current === "sheep" || current === "goats"));

  return (
    <Screen
      title={step === "top" ? "What are you working with?" : "Sheep or goats?"}
      subtitle={step === "top" ? "You can switch later from Profile" : "Shoats are managed by herd numbers"}
      back={step === "shoats" || !!current}
    >
      {step === "shoats" && !current ? (
        <Pressable onPress={() => setStep("top")} hitSlop={8} accessibilityRole="button">
          <Text style={s.link}>Back to animal type</Text>
        </Pressable>
      ) : null}
      {options.map((o) => (
        <Pressable
          key={o.id}
          testID={`choose-${o.id}`}
          accessibilityRole="button"
          accessibilityLabel={o.label}
          onPress={() => pick(o.id)}
          style={({ pressed }) => [s.card, selected(o.id) && s.cardOn, pressed && { backgroundColor: c.bgMuted }]}
        >
          <MaterialCommunityIcons name={o.icon} size={34} color={c.text} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.label}>{o.label}</Text>
            <Text style={s.blurb}>{o.blurb}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={c.textSubtle} />
        </Pressable>
      ))}
    </Screen>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      padding: 18,
      marginBottom: 12,
      borderRadius: RADIUS.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.bg,
    },
    cardOn: { borderWidth: 1.5, borderColor: c.text },
    label: { fontSize: 18, ...font("600"), color: c.text },
    blurb: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    link: { fontSize: 13, color: c.text, textDecorationLine: "underline", marginBottom: 12 },
  });
