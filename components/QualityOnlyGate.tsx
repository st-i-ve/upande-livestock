import { router } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FONT_FAMILY } from "@/constants/theme";
import { useAuthStore } from "@/src/auth/authStore";
import { isQualityOnly } from "@/src/auth/roles";
import { useColors } from "@/src/hooks/useColors";

/**
 * Wraps the animals and record routes. A user whose only livestock role is
 * Livestock Quality has no tab for them, but a deep link (a notification, a
 * pasted URL) can still land here: they get a polite message and a way back to
 * the Quality view instead of a form the server would refuse anyway.
 */
export function QualityOnlyGate({ children }: { children: React.ReactNode }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const qualityOnly = isQualityOnly(useAuthStore((st) => st.roles));
  if (!qualityOnly) return <>{children}</>;
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.box}>
        <Text style={s.title}>Not available to your role</Text>
        <Text style={s.text}>
          Your account is set up for recording milk quality only. Animals and the other records are
          for the farm team.
        </Text>
        <Pressable onPress={() => router.replace("/(tabs)/quality")} hitSlop={8}>
          <Text style={s.link}>Go to Quality</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    box: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
    title: { fontFamily: FONT_FAMILY.semibold, fontSize: 18, color: c.text },
    text: { fontFamily: FONT_FAMILY.regular, fontSize: 14, lineHeight: 20, color: c.textMuted, textAlign: "center" },
    link: { fontFamily: FONT_FAMILY.medium, fontSize: 14, color: c.text, textDecorationLine: "underline" },
  });
