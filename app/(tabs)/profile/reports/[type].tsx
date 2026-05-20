import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Divider } from "@/components/Divider";
import { KV } from "@/components/KV";
import { MetricGrid } from "@/components/MetricGrid";
import { Pill } from "@/components/Pill";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { COLORS, FONT_FAMILY } from "@/constants/theme";

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={s.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function MilkYield() {
  return (
    <Screen title="Milk yield" subtitle="Last 30 days" back>
      <SectionHeader title="Overview" subtitle="Production, revenue and discard summary" />
      <MetricGrid items={[
        { label: "30d total", value: "28,460", sub: "kg, +4.2%" },
        { label: "Per cow", value: "22.6", sub: "kg/day" },
        { label: "Revenue", value: "1.69M", sub: "KES" },
        { label: "Discarded", value: "312", sub: "kg, 1.1%" },
      ]} />

      <Divider />

      <SectionHeader title="By herd" subtitle="Total kg over the last 30 days" />
      <KV k="Lactating group 1" v="14,920 kg" />
      <KV k="Lactating group 2" v="8,540 kg" />
      <KV k="Super high yielders" v="5,000 kg" />
    </Screen>
  );
}

function Reproduction() {
  return (
    <Screen title="Reproduction" subtitle="Last 12 months" back>
      <SectionHeader title="Performance" subtitle="Targets vs. actual on key fertility KPIs" />
      <MetricGrid items={[
        { label: "Conception", value: "62%", sub: "target 60%" },
        { label: "Days open", value: "112", sub: "target 100" },
        { label: "Calving int.", value: "395", sub: "days" },
        { label: "Straws/preg", value: "2.1", sub: "target 2.0" },
      ]} />

      <Divider />

      <SectionHeader title="Open events" subtitle="Cows past their expected PD or service window" />
      <Row left={<Avatar icon="clock-outline" tone="warning" />} title="AMALIA-129272" meta="Served 55 days ago · PD overdue" right={<Pill label="Overdue" tone="warning" />} />
      <Row left={<Avatar icon="clock-outline" tone="calf" />} title="BROOKE-129297" meta="Served 38 days ago" right={<Pill label="Awaiting" tone="preg" />} />
    </Screen>
  );
}

function HealthCosts() {
  return (
    <Screen title="Health & costs" subtitle="Last 12 months" back>
      <SectionHeader title="Spending overview" subtitle="Year-to-date totals at a glance" />
      <MetricGrid items={[
        { label: "Vet spend", value: "285,400", sub: "KES YTD" },
        { label: "Cases", value: "38", sub: "14 mastitis" },
        { label: "Avg / case", value: "7,510", sub: "KES" },
        { label: "Discard loss", value: "189k", sub: "KES, 3,150 kg" },
      ]} />

      <Divider />

      <SectionHeader title="By condition" subtitle="Where the money is going" />
      <KV k="Mastitis (clinical)" v="142,300 KES" />
      <KV k="Lameness" v="68,920 KES" />
      <KV k="Metritis" v="34,180 KES" />
      <KV k="Other / minor" v="40,000 KES" />

      <Divider />

      <SectionHeader title="Top spenders" subtitle="Animals with the highest treatment cost" />
      <Row left={<Avatar icon="stethoscope" tone="danger" />} title="EDEN-129339" meta="3 cases · 35,200 KES total" right={<Pill label="High" tone="danger" />} />
      <Row left={<Avatar icon="stethoscope" tone="warning" />} title="TEST IVY" meta="1 case · 6,570 KES" right={<Pill label="Open" tone="warning" />} />

      <Divider />

      <SectionHeader title="Recent treatments" subtitle="Last 30 days of clinical activity" />
      <Row left={<Avatar icon="needle" tone="calf" />} title="EDEN · Intramammary course" meta="6 May · 8,400 KES · ongoing" />
      <Row left={<Avatar icon="needle" tone="calf" />} title="TEST IVY · Tilmicosin" meta="3 May · 6,570 KES · monitoring" />
      <Row left={<Avatar icon="needle" tone="calf" />} title="ADAM · Udder oedema gel" meta="11 Mar · 1,200 KES · resolved" />
    </Screen>
  );
}

function CalfGrowth() {
  return (
    <Screen title="Calf growth" subtitle="Youngstock 0-12 months" back>
      <SectionHeader title="Performance" subtitle="Average daily gain and target adherence" />
      <MetricGrid items={[
        { label: "Avg ADG", value: "780", sub: "g/day, target 850" },
        { label: "On target", value: "62%", sub: "22 of 36 calves" },
        { label: "Mortality", value: "2.8%", sub: "target <5%" },
        { label: "Wean wt", value: "82", sub: "kg @ d90" },
      ]} />

      <Divider />

      <SectionHeader title="Need attention" subtitle="Below growth curve and worth a check" />
      <Row left={<Avatar icon="trending-down" tone="warning" />} title="TEST BLOSSOM · 24 d · 42 kg" meta="ADG 250 g/d · below target" right={<Pill label="Watch" tone="warning" />} />
    </Screen>
  );
}

function UnknownReport() {
  return (
    <Screen title="Report" back>
      <View style={s.empty}>
        <MaterialCommunityIcons name="file-question-outline" size={48} color={COLORS.textSubtle} />
        <Text style={s.emptyText}>This report does not exist in the demo dataset.</Text>
      </View>
    </Screen>
  );
}

export default function Report() {
  const { type } = useLocalSearchParams<{ type: string }>();
  if (type === "milk") return <MilkYield />;
  if (type === "repro") return <Reproduction />;
  if (type === "health") return <HealthCosts />;
  if (type === "growth") return <CalfGrowth />;
  return <UnknownReport />;
}

const s = StyleSheet.create({
  sectionHeader: {
    marginTop: 4,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    color: COLORS.text,
    fontFamily: FONT_FAMILY.semibold,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.regular,
    marginTop: 3,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.regular,
    textAlign: "center",
  },
});
