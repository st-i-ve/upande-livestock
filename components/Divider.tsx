import React from "react";
import { StyleSheet, View } from "react-native";

import { COLORS } from "@/constants/theme";

type Variant = "line" | "block";

export function Divider({ variant = "line" }: { variant?: Variant }) {
  if (variant === "block") return <View style={s.block} />;
  return <View style={s.line} />;
}

const s = StyleSheet.create({
  line: {
    height: 1,
    backgroundColor: COLORS.borderSubtle,
    marginVertical: 18,
  },
  block: {
    height: 6,
    backgroundColor: COLORS.bgMuted,
    marginVertical: 20,
    marginHorizontal: -14,
  },
});
