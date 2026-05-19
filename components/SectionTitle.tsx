import React from "react";
import { StyleSheet, Text, type TextStyle } from "react-native";
import { COLORS } from "@/constants/theme";

export function SectionTitle({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[s.t, style]}>{children}</Text>;
}

const s = StyleSheet.create({
  t: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 14,
    marginBottom: 8,
  },
});
