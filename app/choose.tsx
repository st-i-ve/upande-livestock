import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { MorphIn } from "@/components/MorphIn";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SilhouetteArt } from "@/components/AnimalSilhouette";
import { Screen } from "@/components/Screen";
import { RADIUS, font } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { homeOf, useAnimalType, type AnimalType } from "@/src/shoats/animalType";
import type { Silhouette } from "@/src/silhouettes";

/** Each card wears the farm's traced drawings (Shoats: the sheep and the goat side by side). */
type Option = { id: string; label: string; blurb: string; art: Silhouette[] };

/** The drawing box: the old 34 px glyph's height, wide enough for a cow side on. */
const ART_W = 52;
const ART_H = 34;

const TOP: Option[] = [
  { id: "cattle", label: "Cattle", blurb: "Individual animals: weights, breeding, health, feeding.", art: ["cow"] },
  { id: "shoats", label: "Shoats", blurb: "Sheep and goats, kept by herd numbers.", art: ["sheep", "goat"] },
];
const SHOATS: Option[] = [
  { id: "sheep", label: "Sheep", blurb: "Flocks: ewes, rams, lambs.", art: ["sheep"] },
  { id: "goats", label: "Goats", blurb: "Herds: does, bucks, kids.", art: ["goat"] },
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
    <MorphIn>
      <Screen
        title={step === "top" ? "What are you working with?" : "Sheep or goats?"}
        subtitle={step === "top" ? "You can switch later from Profile" : "Shoats are managed by herd numbers"}
        back={step === "shoats" || !!current}
      >
        {/* Always offered on the second step: someone already working with sheep or
            goats lands here first and must be able to get back to Cattle. */}
        {step === "shoats" ? (
          <Pressable
            onPress={() => setStep("top")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back to animal type"
            style={({ pressed }) => [s.backBtn, pressed && { backgroundColor: c.bgMuted }]}
          >
            <MaterialCommunityIcons name="arrow-left" size={18} color={c.text} />
            <Text style={s.backLabel}>Back to animal type</Text>
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
            <View style={s.art} testID={`choose-art-${o.id}`}>
              {o.art.map((pose) => (
                <SilhouetteArt
                  key={pose}
                  pose={pose}
                  color={c.text}
                  width={o.art.length > 1 ? ART_W / 2 : ART_W}
                  height={o.art.length > 1 ? ART_H * 0.8 : ART_H}
                />
              ))}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.label}>{o.label}</Text>
              <Text style={s.blurb}>{o.blurb}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={c.textSubtle} />
          </Pressable>
        ))}
      </Screen>
    </MorphIn>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    art: { width: ART_W, height: ART_H, flexDirection: "row", alignItems: "flex-end", justifyContent: "center" },
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
    backBtn: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginBottom: 16,
      borderRadius: RADIUS.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.bg,
    },
    backLabel: { fontSize: 14, ...font("600"), color: c.text },
  });
