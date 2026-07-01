import React, { useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useColors } from "@/src/hooks/useColors";

export function Loader({ fill = false }: { fill?: boolean }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={fill ? s.fill : s.inline}>
      <ActivityIndicator size="small" color={c.text} />
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    fill: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg },
    inline: { paddingVertical: 32, alignItems: "center", justifyContent: "center" },
  });
