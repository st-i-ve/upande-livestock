import { useLocalSearchParams } from "expo-router";
import React from "react";

import { Avatar } from "@/components/Avatar";
import { Banner } from "@/components/Banner";
import { MetricGrid } from "@/components/MetricGrid";
import { Pill } from "@/components/Pill";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";

export default function Inventory() {
  const { type } = useLocalSearchParams<{ type: string }>();

  if (type === "colostrum") {
    return (
      <Screen title="Colostrum bank" subtitle="3.0 kg in stock" back>
        <Banner tone="warning">Stock low. 2 calvings expected in 14 days requiring ~8 kg.</Banner>
        <MetricGrid items={[
          { label: "In stock", value: "3.0", sub: "kg, 1 batch" },
          { label: "Value", value: "300", sub: "KES" },
          { label: "Issued 30d", value: "12.4", sub: "kg" },
          { label: "Need 14d", value: "~8", sub: "kg" },
        ]} />
        <SectionTitle>Batches</SectionTitle>
        <Row left={<Avatar icon="water" tone="calf" />} title="COL-2026-04-15-A" meta="From TEST IVY · 15 Apr" right={<Pill label="3.0 kg" tone="success" />} />
      </Screen>
    );
  }

  if (type === "drugs") {
    const items = [
      { n: "FMD Vaccine", b: "FMD-26-B201", q: "42 doses", ok: true },
      { n: "LSD Vaccine", b: "LSD-26-A012", q: "36 doses", ok: true },
      { n: "Procaine Penicillin G", b: "PEN-25-K887", q: "3 vials", ok: false },
      { n: "Albendazole 10%", b: "ALB-26-K112", q: "8 L", ok: true },
      { n: "Ivermectin 1%", b: "IVE-26-B077", q: "2.4 L", ok: true },
      { n: "Buparvaquone (Butalex)", b: "BUP-25-A103", q: "1 vial", ok: false },
    ];
    return (
      <Screen title="Drug inventory" subtitle="23 SKUs" back>
        <Banner tone="warning">2 items below safety stock</Banner>
        {items.map((d) => (
          <Row
            key={d.n}
            left={<Avatar icon="pill" tone={d.ok ? "calf" : "danger"} />}
            title={d.n}
            meta={d.b}
            right={<Pill label={d.q} tone={d.ok ? "success" : "danger"} />}
          />
        ))}
      </Screen>
    );
  }

  if (type === "semen") {
    return (
      <Screen title="Semen straws" subtitle="Stock items · Stores - WDL" back>
        <Banner tone="info">Each semen straw is a stock Item. Service / AI events issue 1 unit on submit.</Banner>
        <Row left={<Avatar icon="test-tube" tone="bull" />} title="Semen Delta Stormer-F" meta="Item 4040030377 · 2,400 KES/straw" right={<Pill label="28 straws" tone="success" />} />
        <Row left={<Avatar icon="test-tube" tone="bull" />} title="Semen Delta Keen-F" meta="Item 4040030372 · 2,200 KES/straw" right={<Pill label="15 straws" tone="success" />} />
      </Screen>
    );
  }

  if (type === "feed") {
    return (
      <Screen title="Feed inventory" subtitle="Multiple warehouses" back>
        <Row left={<Avatar icon="water" tone="calf" />} title="WestWood Dairy Milk (kg)" meta="Finished Goods - WDL" right={<Pill label="485 kg" tone="success" />} />
        <Row left={<Avatar icon="water" tone="warning" />} title="Colostrum (kg)" meta="Stores - WDL" right={<Pill label="3 kg" tone="danger" />} />
        <Row left={<Avatar icon="grain" tone="calf" />} title="Calf starter pellets" meta="Stores - WDL" right={<Pill label="240 kg" tone="success" />} />
        <Row left={<Avatar icon="grain" tone="calf" />} title="Maize silage" meta="Silage Pit 1" right={<Pill label="42 t" tone="success" />} />
      </Screen>
    );
  }

  return (
    <Screen title="Inventory" back>
      <SectionTitle>Unknown inventory</SectionTitle>
    </Screen>
  );
}
