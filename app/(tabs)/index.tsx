import { router } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar, type AvatarTone } from "@/components/Avatar";
import { Banner } from "@/components/Banner";
import { ErrorState } from "@/components/ErrorState";
import { Loader } from "@/components/Loader";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { APP, RADIUS } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { useAuthStore } from "@/src/auth/authStore";
import { extractFrappeError } from "@/src/services/api";
import { useOpenHealthCaseCount } from "@/src/hooks/useHealthCases";
import { useSafetyAlerts } from "@/src/hooks/useSafetyAlerts";
import { useTodaysMilk } from "@/src/hooks/useTodaysMilk";

export default function Home() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const fullname = useAuthStore((s) => s.fullname) || APP.user;
  const milk = useTodaysMilk();
  const alerts = useSafetyAlerts();
  const openCases = useOpenHealthCaseCount();

  const totalRecorded = (milk.data ?? []).reduce(
    (sum, r) => sum + (r.am ?? 0) + (r.pm ?? 0),
    0,
  );

  const error = milk.error || alerts.error;
  const isLoading = milk.isLoading || alerts.isLoading;

  const refresh = async () => {
    await Promise.all([milk.refetch(), alerts.refetch()]);
  };

  return (
    <Screen
      title={APP.farm}
      subtitle={APP.location}
      onRefresh={refresh}
      refreshing={false}
    >
      <Banner tone="success" icon="account">
        Signed in as <Text style={{ fontWeight: "700" }}>{fullname}</Text>. Events you submit will be tagged to you.
      </Banner>

      {isLoading ? (
        <Loader />
      ) : error ? (
        <ErrorState text={extractFrappeError(error)} onRetry={refresh} />
      ) : (
        <>
          {/* Two compact tiles: today's recorded milk vs open cases. */}
          <View style={s.topRow}>
            <View style={s.topCell}>
              <Text style={s.topLabel}>Today's milk</Text>
              <Text style={s.topValue}>{Math.round(totalRecorded)} kg</Text>
              <Text style={s.topSub}>recorded so far</Text>
            </View>
            <Pressable
              style={s.topCell}
              onPress={() => router.push("/(tabs)/alerts/cases")}
            >
              <Text style={s.topLabel}>Open cases</Text>
              <Text style={s.topValue}>
                {openCases.isLoading ? "…" : (openCases.data ?? 0)}
              </Text>
              <Text style={s.topSub}>open + under treatment</Text>
            </Pressable>
          </View>

          <SectionTitle>Today's milk by herd</SectionTitle>
          {(milk.data ?? []).length === 0 ? (
            <Banner tone="info">No milk recorded yet today.</Banner>
          ) : (
            (milk.data ?? []).map((r) => (
              <Pressable
                key={r.herd}
                onPress={() => router.push(`/(tabs)/animals/herds/${encodeURIComponent(r.herd)}`)}
                style={({ pressed }) => [s.herdRow, pressed && { backgroundColor: c.bgMuted }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.herdName} numberOfLines={1}>{r.herd}</Text>
                  <Text style={s.herdMeta}>
                    {r.cnt} cows
                    {r.expected ? ` · expected ~${r.expected} kg/day` : ""}
                  </Text>
                </View>
                <View style={s.session}>
                  <Text style={s.sessLbl}>AM</Text>
                  <Text style={[s.sessVal, r.am === null && s.sessPending]}>
                    {r.am !== null ? `${Math.round(r.am)} kg` : "pending"}
                  </Text>
                </View>
                <View style={s.session}>
                  <Text style={s.sessLbl}>PM</Text>
                  <Text style={[s.sessVal, r.pm === null && s.sessPending]}>
                    {r.pm !== null ? `${Math.round(r.pm)} kg` : "pending"}
                  </Text>
                </View>
              </Pressable>
            ))
          )}

          <SectionTitle>Action queue · milk safety</SectionTitle>
          {alerts.data.length === 0 ? (
            <Banner tone="info">Nothing to action right now.</Banner>
          ) : (
            alerts.data.map((a, i) => (
              <Row
                key={i}
                left={<Avatar icon={a.ic as any} tone={a.sev as AvatarTone} />}
                title={a.t}
                meta={a.s}
                chevron
                onPress={() => router.push("/(tabs)/alerts")}
              />
            ))
          )}
        </>
      )}
    </Screen>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    topRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
    topCell: {
      flex: 1,
      backgroundColor: c.bgMuted,
      borderRadius: RADIUS.md,
      padding: 12,
    },
    topLabel: { fontSize: 11, color: c.textMuted },
    topValue: { fontSize: 22, fontWeight: "700", color: c.text, marginTop: 2, fontVariant: ["tabular-nums"] },
    topSub: { fontSize: 10, color: c.textMuted, marginTop: 2 },
    herdRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderSubtle,
    },
    herdName: { fontSize: 13, fontWeight: "600", color: c.text },
    herdMeta: { fontSize: 11, color: c.textMuted, marginTop: 1 },
    session: { alignItems: "flex-end", minWidth: 56 },
    sessLbl: { fontSize: 9, color: c.textSubtle, textTransform: "uppercase", letterSpacing: 0.5 },
    sessVal: { fontSize: 12, color: c.text, fontWeight: "600", fontVariant: ["tabular-nums"] },
    sessPending: { color: c.textSubtle, fontWeight: "400", fontStyle: "italic" },
  });
