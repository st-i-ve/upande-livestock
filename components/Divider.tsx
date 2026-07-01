import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { useColors } from "@/src/hooks/useColors";

type Variant = "line" | "block";

export function Divider({ variant = "line" }: { variant?: Variant }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  if (variant === "block") return <View style={s.block} />;
  return <View style={s.line} />;
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    line: {
      height: 1,
      backgroundColor: c.borderSubtle,
      marginVertical: 18,
    },
    block: {
      height: 6,
      backgroundColor: c.bgMuted,
      marginVertical: 20,
      marginHorizontal: -14,
    },
  });
