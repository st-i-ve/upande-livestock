import { router } from "expo-router";
import React from "react";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Pill } from "@/components/Pill";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";

const DX = [
  { name: "TEST IVY · Udder hot/swollen", meta: "Yesterday 9:00 · BCS 3.0 · escalated to case HC-160120", pill: "→ Case" },
  { name: "BELLA · Routine check",       meta: "Today 7:30 · BCS 3.5 · all clear",                       pill: "No action" },
  { name: "DOLLY · Pre-calving check",   meta: "Today 7:00 · BCS 4.0 · monitor (steaming)",              pill: "Monitor" },
  { name: "TEST BLOSSOM · Calf check",   meta: "Today 6:30 · alert · good appetite",                     pill: "No action" },
  { name: "SONIA · Off feed",            meta: "Mon 8 May · BCS 2.5 · monitoring",                       pill: "Monitor" },
  { name: "EDEN · Lameness 2/3",         meta: "Sat 3 May · escalated to case HC-160093",                pill: "→ Case" },
];

export default function Diagnoses() {
  return (
    <Screen title="Diagnoses" subtitle="Routine health observations" back>
      <Button label="New diagnosis" icon="plus" onPress={() => router.push("/(tabs)/record/events/diagnosis")} />
      <SectionTitle>Recent</SectionTitle>
      {DX.map((d, i) => (
        <Row
          key={i}
          left={<Avatar icon="magnify" />}
          title={d.name}
          meta={d.meta}
          right={<Pill label={d.pill} />}
        />
      ))}
    </Screen>
  );
}
