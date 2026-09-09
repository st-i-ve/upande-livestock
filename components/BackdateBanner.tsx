import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { BACKDATE_AMBER_DARK, BACKDATE_AMBER_LIGHT } from "@/components/BackdateButton";
import { RADIUS } from "@/constants/theme";
import { useScheme } from "@/src/theme/themeStore";

// Verbatim per the spec — including the em dash. Do not reword.
const WARNING =
  "This is a backdating page. You are not affecting stocks — apply wisely. " +
  "The system will run through afterwards.";

/** The standing banner every event screen shows while rendered in backdate
 *  mode (see `useBackdate`). Amber rather than one of `Banner`'s tones — the
 *  app is deliberately monochrome, and this is the one place that breaks it. */
export function BackdateBanner() {
  const amber = useScheme() === "dark" ? BACKDATE_AMBER_DARK : BACKDATE_AMBER_LIGHT;
  const s = useMemo(() => makeStyles(amber), [amber]);
  return (
    <View style={s.box}>
      <MaterialCommunityIcons name="alert-outline" size={16} color={amber} style={{ marginTop: 1 }} />
      <Text style={s.text}>{WARNING}</Text>
    </View>
  );
}

const makeStyles = (amber: string) =>
  StyleSheet.create({
    box: {
      flexDirection: "row",
      gap: 8,
      alignItems: "flex-start",
      borderWidth: 1,
      borderColor: amber,
      backgroundColor: `${amber}14`,
      borderRadius: RADIUS.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 12,
    },
    text: { flex: 1, color: amber, fontSize: 13, lineHeight: 19 },
  });
