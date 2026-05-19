import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Avatar, type AvatarTone } from "@/components/Avatar";
import { Banner } from "@/components/Banner";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { Tile, TileGrid } from "@/components/Tile";
import { APP, COLORS, RADIUS } from "@/constants/theme";
import { safetyAlerts, todaysMilk, todaysMilkRecorded } from "@/data/mock";

const QUICK_ACTIONS: { icon: any; label: string; href: string }[] = [
  { icon: "water",                label: "Milk recording",   href: "/events/milk" },
  { icon: "baby-bottle-outline",  label: "Calf feeding",     href: "/events/calf-feed" },
  { icon: "grain",                label: "Animal feeding",   href: "/events/animal-feed" },
  { icon: "magnify",              label: "Diagnosis",        href: "/events/diagnosis" },
  { icon: "needle",               label: "Vaccination",      href: "/events/vaccination" },
  { icon: "bug",                  label: "Deworming",        href: "/events/deworming" },
  { icon: "fire",                 label: "Heat detection",   href: "/events/heat" },
  { icon: "heart",                label: "Service / AI",     href: "/events/service" },
  { icon: "clipboard-check",      label: "Pregnancy diag.",  href: "/events/pd" },
  { icon: "baby-bottle-outline",  label: "Calving",          href: "/events/calving" },
  { icon: "baby-carriage",        label: "Birth",            href: "/events/birth" },
  { icon: "scale",                label: "Weight",           href: "/events/weight" },
  { icon: "arrow-left-right",     label: "Movement",         href: "/events/movement" },
  { icon: "content-cut",          label: "Dehorning",        href: "/events/dehorning" },
  { icon: "tools",                label: "Hoof trimming",    href: "/events/hoof" },
  { icon: "water-off",            label: "Drying off",       href: "/events/dryoff" },
];

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
        <View key={r.herd} style={s.herdRow}>
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
        </View>
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

      <SectionTitle>Quick actions</SectionTitle>
      <TileGrid>
        {QUICK_ACTIONS.map((q) => (
          <Tile key={q.href} icon={q.icon} title={q.label} onPress={() => router.push(q.href as any)} />
        ))}
      </TileGrid>
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
