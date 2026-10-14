import { useSegments } from "expo-router";
import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FONT_FAMILY } from "@/constants/theme";
import { useAuthStore } from "@/src/auth/authStore";
import {
  NOT_EMPLOYEE_MESSAGE,
  NOT_EMPLOYEE_MILKING_MESSAGE,
  useCanRecord,
} from "@/src/hooks/useCanRecord";
import { useColors } from "@/src/hooks/useColors";

/**
 * Wraps every route that holds a record screen. A user the server has said is
 * not an Employee sees why instead of a form. While the answer is not known
 * (never fetched, or every attempt failed) the user sees a neutral "checking"
 * state with a retry, never the refusal: a failed lookup says nothing about
 * them, and the server enforces the rule regardless.
 */
export function RecordGate({ children }: { children: React.ReactNode }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { canRecord } = useCanRecord();
  const isEmployee = useAuthStore((st) => st.isEmployee);
  const refresh = useAuthStore((st) => st.refreshEmployeeStatus);
  const segments = useSegments() as string[];
  const [tried, setTried] = React.useState(false);
  const [skip, setSkip] = React.useState(false);

  React.useEffect(() => {
    if (isEmployee === null) void refresh().finally(() => setTried(true));
  }, [isEmployee, refresh]);

  if (isEmployee === false || !canRecord) {
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

  if (isEmployee === null && !skip) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.box}>
          {tried ? null : <ActivityIndicator color={c.text} />}
          <Text style={s.text}>Checking your employee link…</Text>
          <Pressable onPress={() => { setTried(false); void refresh().finally(() => setTried(true)); }} hitSlop={8}>
            <Text style={s.link}>Retry</Text>
          </Pressable>
          {tried ? (
            <Pressable onPress={() => setSkip(true)} hitSlop={8}>
              <Text style={s.link}>Continue anyway</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    box: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
    title: { fontFamily: FONT_FAMILY.semibold, fontSize: 18, color: c.text },
    text: { fontFamily: FONT_FAMILY.regular, fontSize: 14, lineHeight: 20, color: c.textMuted, textAlign: "center" },
    link: { fontFamily: FONT_FAMILY.medium, fontSize: 14, color: c.text, textDecorationLine: "underline" },
  });
