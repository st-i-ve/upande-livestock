import { router } from "expo-router";
import React from "react";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { MetricGrid } from "@/components/MetricGrid";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";

export default function CullsList() {
  return (
    <Screen title="Culls / deaths" subtitle="Animals removed without sale" back>
      <MetricGrid
        items={[
          { label: "YTD write-off", value: "−620,000", sub: "7 animals · KES" },
          { label: "Top reason", value: "Mastitis", sub: "3 animals", small: true },
        ]}
      />
      <Button label="Record cull / death" icon="delete" variant="danger" onPress={() => router.push("/culls/new")} />
      <SectionTitle>Recent</SectionTitle>
      <Row left={<Avatar icon="delete" tone="danger" />} title="JACKI-129390 · Culled (Farm Use)" meta="2 May · book 150,000 written off" />
      <Row left={<Avatar icon="delete" tone="danger" />} title="VICTOR-129572 · Died — Disease" meta="14 Apr · book 120,000 written off" />
    </Screen>
  );
}
