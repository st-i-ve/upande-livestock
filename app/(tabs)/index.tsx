import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar, type AvatarTone } from "@/components/Avatar";
import { Banner } from "@/components/Banner";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { APP, COLORS, RADIUS } from "@/constants/theme";
import { safetyAlerts, todaysMilk, todaysMilkRecorded } from "@/data/mock";

export default function Home() {
  return (
    <Screen title={APP.farm} subtitle={APP.location}>
      <Banner tone="success" icon="account">
        Signed in as <Text style={{ fontWeight: "700" }}>{APP.user}</Text>. Events you submit will be tagged to you.
      </Banner>

      {/* Two compact tiles: today's recorded milk vs open cases. */}
      <View style={s.topRow}>
        <View style={s.topCell}>
          <Text style={s.topLabel}>Today's milk</Text>
          <Text style={s.topValue}>{todaysMilkRecorded} kg</Text>
          <Text style={s.topSub}>recorded so far</Text>
        </View>
        <View style={s.topCell}>
          <Text style={s.topLabel}>Open cases</Text>
          <Text style={s.topValue}>3</Text>
          <Text style={s.topSub}>1 mastitis, 2 lameness</Text>
        </View>
      </View>

      <SectionTitle>Today's milk by herd</SectionTitle>
      {todaysMilk.map((r) => (
        <Pressable
          key={r.herd}
          onPress={() => router.push(`/(tabs)/animals/herds/${encodeURIComponent(r.herd)}`)}
          style={({ pressed }) => [s.herdRow, pressed && { backgroundColor: COLORS.bgMuted }]}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.herdName} numberOfLines={1}>{r.herd}</Text>
            <Text style={s.herdMeta}>{r.cnt} cows · expected ~{r.expected} kg/day</Text>
          </View>
          <View style={s.session}>
            <Text style={s.sessLbl}>AM</Text>
            <Text style={[s.sessVal, r.am === null && s.sessPending]}>
              {r.am !== null ? `${r.am} kg` : "pending"}
            </Text>
          </View>
          <View style={s.session}>
            <Text style={s.sessLbl}>PM</Text>
            <Text style={[s.sessVal, r.pm === null && s.sessPending]}>
              {r.pm !== null ? `${r.pm} kg` : "pending"}
            </Text>
          </View>
        </Pressable>
      ))}

      <SectionTitle>Action queue · milk safety</SectionTitle>
      {safetyAlerts.map((a, i) => (
        <Row
          key={i}
          left={<Avatar icon={a.ic as any} tone={a.sev as AvatarTone} />}
          title={a.t}
          meta={a.s}
          chevron
          onPress={() => router.push("/(tabs)/alerts")}
        />
      ))}

    </Screen>
  );
}

const s = StyleSheet.create({
  topRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  topCell: {
    flex: 1,
    backgroundColor: COLORS.bgMuted,
    borderRadius: RADIUS.md,
    padding: 12,
  },
  topLabel: { fontSize: 11, color: COLORS.textMuted },
  topValue: { fontSize: 22, fontWeight: "700", color: COLORS.text, marginTop: 2, fontVariant: ["tabular-nums"] },
  topSub: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  herdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderSubtle,
  },
  herdName: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  herdMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  session: { alignItems: "flex-end", minWidth: 56 },
  sessLbl: { fontSize: 9, color: COLORS.textSubtle, textTransform: "uppercase", letterSpacing: 0.5 },
  sessVal: { fontSize: 12, color: COLORS.text, fontWeight: "600", fontVariant: ["tabular-nums"] },
  sessPending: { color: COLORS.textSubtle, fontWeight: "400", fontStyle: "italic" },
});
