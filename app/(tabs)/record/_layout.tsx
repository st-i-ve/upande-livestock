import { Stack, useSegments } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FONT_FAMILY } from "@/constants/theme";
import {
  NOT_EMPLOYEE_MESSAGE,
  NOT_EMPLOYEE_MILKING_MESSAGE,
  useCanRecord,
} from "@/src/hooks/useCanRecord";
import { useColors } from "@/src/hooks/useColors";

/**
 * Every record screen lives under here, so this is the one place a user with no
 * Employee is stopped when they reach one directly (a deep link, a stale
 * route). They see why, not a form. The server refuses their records anyway.
 */
export default function RecordStackLayout() {
  const c = useColors();
  const { canRecord } = useCanRecord();
  const segments = useSegments() as string[];
  const s = useMemo(() => makeStyles(c), [c]);

  if (!canRecord) {
    const milking = segments.includes("milk");
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.box}>
          <Text style={s.title}>View only</Text>
          <Text style={s.text}>{milking ? NOT_EMPLOYEE_MILKING_MESSAGE : NOT_EMPLOYEE_MESSAGE}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.bg },
        animation: "fade",
      }}
    />
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    box: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
    title: { fontFamily: FONT_FAMILY.semibold, fontSize: 18, color: c.text },
    text: { fontFamily: FONT_FAMILY.regular, fontSize: 14, lineHeight: 20, color: c.textMuted, textAlign: "center" },
  });
