import { useLocalSearchParams } from "expo-router";
import React from "react";

import { Avatar } from "@/components/Avatar";
import { KV } from "@/components/KV";
import { MetricGrid } from "@/components/MetricGrid";
import { Pill } from "@/components/Pill";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { COLORS } from "@/constants/theme";

export default function Report() {
  const { type } = useLocalSearchParams<{ type: string }>();

  if (type === "milk") {
    return (
      <Screen title="Milk yield" subtitle="Last 30 days" back>
        <MetricGrid items={[
          { label: "30d total", value: "28,460", sub: "kg, +4.2%" },
          { label: "Per cow", value: "22.6", sub: "kg/day" },
          { label: "Revenue", value: "1.69M", sub: "KES" },
          { label: "Discarded", value: "312", sub: "kg, 1.1%" },
        ]} />
        <SectionTitle>By herd · 30 days</SectionTitle>
        <KV k="Lactating group 1" v="14,920 kg" />
        <KV k="LACTATION GROUP 2" v="8,540 kg" />
        <KV k="Super high yielders" v="5,000 kg" />
      </Screen>
    );
  }
  if (type === "repro") {
    return (
      <Screen title="Reproduction" subtitle="Last 12 months" back>
        <MetricGrid items={[
          { label: "Conception", value: "62%", sub: "target 60%" },
          { label: "Days open", value: "112", sub: "target 100" },
          { label: "Calving int.", value: "395", sub: "days" },
          { label: "Straws/preg", value: "2.1", sub: "target 2.0" },
        ]} />
        <SectionTitle>Open events</SectionTitle>
        <Row left={<Avatar icon="clock-outline" tone="warning" />} title="AMALIA-129272" meta="Served 55 days ago · PD overdue" right={<Pill label="Overdue" tone="warning" />} />
        <Row left={<Avatar icon="clock-outline" tone="calf" />} title="BROOKE-129297" meta="Served 38 days ago" right={<Pill label="Awaiting" tone="preg" />} />
      </Screen>
    );
  }
  if (type === "health") {
    return (
      <Screen title="Health & costs" subtitle="Last 12 months" back>
        <MetricGrid items={[
          { label: "Vet spend", value: "285,400", sub: "KES YTD" },
          { label: "Cases", value: "38", sub: "14 mastitis" },
          { label: "Avg / case", value: "7,510", sub: "KES" },
          { label: "Discard loss", value: "189k", sub: "KES, 3,150 kg" },
        ]} />
        <SectionTitle>Top spenders</SectionTitle>
        <Row left={<Avatar icon="stethoscope" tone="danger" />} title="EDEN-129339" meta="3 cases · 35,200 KES total" />
        <Row left={<Avatar icon="stethoscope" tone="warning" />} title="TEST IVY" meta="1 case · 6,570 KES" />
      </Screen>
    );
  }
  if (type === "growth") {
    return (
      <Screen title="Calf growth" subtitle="Youngstock 0-12 months" back>
        <MetricGrid items={[
          { label: "Avg ADG", value: "780", sub: "g/day, target 850" },
          { label: "On target", value: "62%", sub: "22 of 36 calves" },
          { label: "Mortality", value: "2.8%", sub: "target <5%" },
          { label: "Wean wt", value: "82", sub: "kg @ d90" },
        ]} />
        <SectionTitle>Need attention</SectionTitle>
        <Row left={<Avatar icon="trending-down" tone="warning" />} title="TEST BLOSSOM · 24 d · 42 kg" meta="ADG 250 g/d · below target" />
      </Screen>
    );
  }
  return (
    <Screen title="Report" back>
      <SectionTitle>Unknown report</SectionTitle>
    </Screen>
  );
}
