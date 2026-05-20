import { router } from "expo-router";
import React from "react";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { MetricGrid } from "@/components/MetricGrid";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { Tile, TileGrid } from "@/components/Tile";
import { Timeline } from "@/components/Timeline";
import { animals } from "@/data/mock";
import { ageMonths } from "@/services/utils";

export function AnimalDetail({ id }: { id: string }) {
  const a = animals.find((x) => x.id === id);
  if (!a) {
    return (
      <Screen title="Not found" back>
        <Banner tone="warning">Animal {id} not found in this demo dataset.</Banner>
      </Screen>
    );
  }
  const age = ageMonths(a.dob);

  return (
    <Screen title={a.name} subtitle={a.id} back>
      {a.inTreatment ? (
        <Banner tone="danger">
          In treatment · milk withdrawal until <strong>{a.milkSafe}</strong>
        </Banner>
      ) : null}

      <MetricGrid
        items={[
          { label: "Sex / age", value: a.sex === "F" ? "Female" : "Male", sub: `${age} months`, small: true },
          { label: "Last weight", value: `${a.lastWt} kg` },
          { label: "Herd", value: a.herd, small: true },
          { label: "Parity / DIM", value: `${a.parity}${a.dim !== null ? ` / ${a.dim}d` : ""}`, small: true },
        ]}
      />

      <SectionTitle>Quick actions</SectionTitle>
      <TileGrid>
        <Tile icon="magnify" title="Diagnose" onPress={() => router.push("/events/diagnosis")} />
        {a.repro === "Calf" ? (
          <>
            <Tile icon="baby-bottle-outline" title="Feed" onPress={() => router.push("/events/calf-feed")} />
            <Tile icon="scale" title="Weigh" onPress={() => router.push("/events/weight")} />
            <Tile icon="arrow-left-right" title="Move" onPress={() => router.push("/events/movement")} />
          </>
        ) : (
          <>
            <Tile icon="needle" title="Vaccinate" onPress={() => router.push("/events/vaccination")} />
            <Tile icon="heart" title="Service" onPress={() => router.push("/events/service")} />
            <Tile icon="arrow-left-right" title="Move" onPress={() => router.push("/events/movement")} />
          </>
        )}
      </TileGrid>

      <SectionTitle>Lifetime timeline</SectionTitle>
      <Timeline
        events={[
          { date: "Yesterday 16:00", title: "Mastitis case opened", desc: "Front-left quarter · Penicillin IMM ×3" },
          { date: "Yesterday 09:00", title: "Diagnosis: udder swelling", desc: "Lameness 0/4 · BCS 3.0 · escalated to case" },
          { date: "25 Apr 2026", title: "Anthrax vaccination", desc: "10 ml IM · 5d withdrawal" },
          { date: "15 Apr 2026", title: "Calving — live female", desc: "Calf TESTBC-001/26 · 36 kg" },
        ]}
      />

      <Button label="View full history" variant="outline" />
    </Screen>
  );
}
