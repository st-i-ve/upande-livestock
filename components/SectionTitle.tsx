import React, { useMemo } from "react";
import { StyleSheet, Text, type TextStyle } from "react-native";
import { useColors } from "@/src/hooks/useColors";

export function SectionTitle({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return <Text style={[s.t, style]}>{children}</Text>;
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    t: {
      fontSize: 11,
      fontWeight: "600",
      color: c.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginTop: 14,
      marginBottom: 8,
    },
  });
