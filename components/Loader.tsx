import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { COLORS } from "@/constants/theme";

export function Loader({ fill = false }: { fill?: boolean }) {
  return (
    <View style={fill ? s.fill : s.inline}>
      <ActivityIndicator size="small" color={COLORS.text} />
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg },
  inline: { paddingVertical: 32, alignItems: "center", justifyContent: "center" },
});
