import { router, useLocalSearchParams, useSegments } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useBackdatingWindow } from "@/src/hooks/useBackdatingWindow";
import { useScheme } from "@/src/theme/themeStore";

/** Amber, because this is the control that takes you somewhere the normal
 *  rules do not apply. It should not read as one more neutral header action —
 *  the rest of the app is deliberately monochrome (constants/theme.ts), so
 *  this is the one control allowed to break that. */
export const BACKDATE_AMBER_LIGHT = "#B45309";
export const BACKDATE_AMBER_DARK = "#F59E0B";

export function BackdateButton({ type }: { type: string }) {
  const amber = useScheme() === "dark" ? BACKDATE_AMBER_DARK : BACKDATE_AMBER_LIGHT;
  // Closed window: no entry point at all, like the web.
  const { open } = useBackdatingWindow();
  // Opened from an animal: stay in the Animals stack, and keep the animal.
  const fromAnimals = (useSegments() as string[]).includes("animals");
  const { animal } = useLocalSearchParams<{ animal?: string }>();
  if (!open) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Backdate a ${type} record`}
      hitSlop={8}
      onPress={() =>
        router.push({
          pathname: fromAnimals ? "/(tabs)/animals/act/backdate/[type]" : "/(tabs)/record/backdate/[type]",
          params: fromAnimals && animal ? { type, animal } : { type },
        })
      }
      style={({ pressed }) => [
        styles.wrap,
        { borderColor: amber, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons name="time-outline" size={15} color={amber} />
      <Text style={[styles.label, { color: amber }]}>Backdate</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: 999,
  },
  label: { fontSize: 12, fontWeight: "600" },
});
