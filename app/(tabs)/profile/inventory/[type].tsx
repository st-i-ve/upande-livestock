import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Banner } from "@/components/Banner";
import { Divider } from "@/components/Divider";
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

function Colostrum() {
  return (
    <Screen title="Colostrum bank" subtitle="3.0 kg in stock" back>
      <Banner tone="warning">Stock low. 2 calvings expected in 14 days requiring ~8 kg.</Banner>

      <SectionHeader title="Stock overview" subtitle="What's on hand and what's coming" />
      <MetricGrid items={[
        { label: "In stock", value: "3.0", sub: "kg, 1 batch" },
        { label: "Value", value: "300", sub: "KES" },
        { label: "Issued 30d", value: "12.4", sub: "kg" },
        { label: "Need 14d", value: "~8", sub: "kg" },
      ]} />

      <Divider />

      <SectionHeader title="Batches" subtitle="Available colostrum lots" />
      <Row left={<Avatar icon="water" tone="calf" />} title="COL-2026-04-15-A" meta="From TEST IVY · 15 Apr" right={<Pill label="3.0 kg" tone="success" />} />
    </Screen>
  );
}

function Drugs() {
  const sections = [
    {
      title: "Vaccines",
      subtitle: "Routine herd protection",
      items: [
        { n: "FMD Vaccine", b: "FMD-26-B201", q: "42 doses", ok: true },
        { n: "LSD Vaccine", b: "LSD-26-A012", q: "36 doses", ok: true },
      ],
    },
    {
      title: "Antibiotics",
      subtitle: "Treatment use only — prescription required",
      items: [
        { n: "Procaine Penicillin G", b: "PEN-25-K887", q: "3 vials", ok: false },
        { n: "Buparvaquone (Butalex)", b: "BUP-25-A103", q: "1 vial", ok: false },
      ],
    },
    {
      title: "Antiparasitics",
      subtitle: "Deworming and external parasite control",
      items: [
        { n: "Albendazole 10%", b: "ALB-26-K112", q: "8 L", ok: true },
        { n: "Ivermectin 1%", b: "IVE-26-B077", q: "2.4 L", ok: true },
      ],
    },
  ];

  return (
    <Screen title="Drug inventory" subtitle="23 SKUs" back>
      <Banner tone="warning">2 items below safety stock</Banner>
      {sections.map((sec, i) => (
        <View key={sec.title}>
          {i > 0 ? <Divider /> : null}
          <SectionHeader title={sec.title} subtitle={sec.subtitle} />
          {sec.items.map((d) => (
            <Row
              key={d.n}
              left={<Avatar icon="pill" tone={d.ok ? "calf" : "danger"} />}
              title={d.n}
              meta={d.b}
              right={<Pill label={d.q} tone={d.ok ? "success" : "danger"} />}
            />
          ))}
        </View>
      ))}
    </Screen>
  );
}

function Semen() {
  return (
    <Screen title="Semen straws" subtitle="Stock items · Stores - WDL" back>
      <Banner tone="info">Each semen straw is a stock item. Service / AI events issue 1 unit on submit.</Banner>

      <SectionHeader title="Available bulls" subtitle="Active straw inventory" />
      <Row left={<Avatar icon="test-tube" tone="bull" />} title="Semen Delta Stormer-F" meta="Item 4040030377 · 2,400 KES/straw" right={<Pill label="28 straws" tone="success" />} />
      <Row left={<Avatar icon="test-tube" tone="bull" />} title="Semen Delta Keen-F" meta="Item 4040030372 · 2,200 KES/straw" right={<Pill label="15 straws" tone="success" />} />
    </Screen>
  );
}

function Feed() {
  return (
    <Screen title="Feed inventory" subtitle="Multiple warehouses" back>
      <SectionHeader title="Milk & colostrum" subtitle="Finished goods stored cold" />
      <Row left={<Avatar icon="water" tone="calf" />} title="WestWood Dairy Milk (kg)" meta="Finished Goods - WDL" right={<Pill label="485 kg" tone="success" />} />
      <Row left={<Avatar icon="water" tone="warning" />} title="Colostrum (kg)" meta="Stores - WDL" right={<Pill label="3 kg" tone="danger" />} />

      <Divider />

      <SectionHeader title="Concentrates" subtitle="Bagged feed in main stores" />
      <Row left={<Avatar icon="grain" tone="calf" />} title="Calf starter pellets" meta="Stores - WDL" right={<Pill label="240 kg" tone="success" />} />

      <Divider />

      <SectionHeader title="Forage" subtitle="Bulk silage and roughage" />
      <Row left={<Avatar icon="grain" tone="calf" />} title="Maize silage" meta="Silage Pit 1" right={<Pill label="42 t" tone="success" />} />
    </Screen>
  );
}

function UnknownInventory() {
  return (
    <Screen title="Inventory" back>
      <View style={s.empty}>
        <MaterialCommunityIcons name="package-variant-closed" size={48} color={COLORS.textSubtle} />
        <Text style={s.emptyText}>This inventory item does not exist in the demo dataset.</Text>
      </View>
    </Screen>
  );
}

export default function Inventory() {
  const { type } = useLocalSearchParams<{ type: string }>();
  if (type === "colostrum") return <Colostrum />;
  if (type === "drugs") return <Drugs />;
  if (type === "semen") return <Semen />;
  if (type === "feed") return <Feed />;
  return <UnknownInventory />;
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
