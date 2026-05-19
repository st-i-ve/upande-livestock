import { router } from "expo-router";
import React from "react";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { MetricGrid } from "@/components/MetricGrid";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";

export default function SalesList() {
  return (
    <Screen title="Sales" subtitle="Animals sold to buyers" back>
      <MetricGrid
        items={[
          { label: "YTD revenue", value: "285,000", sub: "3 sales · KES" },
          { label: "YTD net P&L", value: "+55,000", sub: "vs book value" },
        ]}
      />
      <Button label="Record sale" icon="cash" onPress={() => router.push("/sales/new")} />
      <SectionTitle>Recent sales</SectionTitle>
      <Row left={<Avatar icon="cash" tone="calf" />} title="TESTDAM-001/22 → Mwangi Butchery" meta="9 May · 95,000 KES · loss 25,000" />
      <Row left={<Avatar icon="cash" tone="calf" />} title="ANAIAH-129273 → Eldoret Co-op" meta="3 Apr · 95,000 KES · gain 15,000" />
      <Row left={<Avatar icon="cash" tone="calf" />} title="ARSHAVIN-129279 → Direct buyer" meta="22 Mar · 95,000 KES · gain 65,000" />
    </Screen>
  );
}
