import { router } from "expo-router";
import React from "react";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Pill } from "@/components/Pill";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";

export default function Cases() {
  return (
    <Screen title="Health cases" subtitle="3 open · 5 closed this month" back>
      <Button label="New case" icon="plus" onPress={() => router.push("/(tabs)/record/cases/new")} />
      <SectionTitle>Open</SectionTitle>
      <Row
        left={<Avatar icon="stethoscope" tone="danger" />}
        title="TEST IVY · Mastitis (Clinical)"
        meta="HC-2026-160120 · 870 KES · since 8 May"
        right={<Pill label="Open" tone="danger" />}
      />
      <Row
        left={<Avatar icon="stethoscope" tone="danger" />}
        title="ADAM · Udder Oedema"
        meta="HC-2026-160094 · since 10 Mar"
        right={<Pill label="Open" tone="danger" />}
      />
      <Row
        left={<Avatar icon="stethoscope" tone="danger" />}
        title="EDEN · Mastitis (Clinical)"
        meta="HC-2026-160093 · since 12 Mar"
        right={<Pill label="Open" tone="danger" />}
      />
      <SectionTitle>Recently closed</SectionTitle>
      <Row
        left={<Avatar icon="stethoscope" />}
        title="MC CAIN · Joint Injury"
        meta="HC-2026-160095 · 500 KES · 3 days"
        right={<Pill label="Recovered" />}
      />
    </Screen>
  );
}
