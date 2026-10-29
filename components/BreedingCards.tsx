import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FONT_FAMILY, RADIUS } from "@/constants/theme";
import type { BreedingCard } from "@/src/beef/breeding";
import { useColors } from "@/src/hooks/useColors";

/**
 * The breeding herds (the mating groups and the bull reserve)
 * as highlighted cards: females and bulls, and the bulls named. Tap one to open it.
 */
export function BreedingCards({ cards, onOpen }: { cards: BreedingCard[]; onOpen: (herd: string) => void }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  if (!cards.length) return null;
  return (
    <View style={s.wrap} testID="breeding-cards">
      {cards.map((k) => (
        <Pressable
          key={k.herd}
          accessibilityRole="button"
          accessibilityLabel={`Breeding herd ${k.herd}`}
          onPress={() => onOpen(k.herd)}
          style={({ pressed }) => [s.card, pressed && { opacity: 0.8 }]}
        >
          <View style={s.head}>
            <MaterialCommunityIcons name="heart-multiple" size={18} color={c.bg} />
            <Text style={s.title} numberOfLines={1}>{k.herd}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={c.bg} />
          </View>
          <Text style={s.counts}>
            {k.females} {k.females === 1 ? "female" : "females"} · {k.bulls} {k.bulls === 1 ? "bull" : "bulls"}
          </Text>
          {k.bullNames.length ? (
            <Text style={s.bulls} numberOfLines={2}>
              Bull{k.bullNames.length === 1 ? "" : "s"}: {k.bullNames.join(", ")}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    wrap: { gap: 10, marginBottom: 12 },
    card: { backgroundColor: c.text, borderRadius: RADIUS.lg, padding: 14, gap: 4 },
    head: { flexDirection: "row", alignItems: "center", gap: 8 },
    title: { flex: 1, fontSize: 16, fontFamily: FONT_FAMILY.semibold, color: c.bg },
    counts: { fontSize: 13, fontFamily: FONT_FAMILY.medium, color: c.bg },
    bulls: { fontSize: 12, fontFamily: FONT_FAMILY.regular, color: c.bg, opacity: 0.85 },
  });
