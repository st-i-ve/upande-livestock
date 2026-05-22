import { router } from "expo-router";
import React, { useMemo } from "react";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { Loader } from "@/components/Loader";
import { MetricGrid } from "@/components/MetricGrid";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { Tile, TileGrid } from "@/components/Tile";
import { Timeline } from "@/components/Timeline";
import { ageMonths } from "@/services/utils";
import { extractFrappeError } from "@/src/services/api";
import { useAnimal } from "@/src/hooks/useAnimal";

export function AnimalDetail({ id }: { id: string }) {
  const { data: a, isLoading, isRefetching, error, refetch } = useAnimal(id);

  // Build the timeline from the weight history child table — every other
  // event source still lives in mock data and will be wired in sub-project #2.
  const timeline = useMemo(() => {
    if (!a) return [];
    return a.weightHistory
      .slice()
      .reverse()
      .slice(0, 8)
      .map((w) => ({
        date: w.recordingDate,
        title: `Weight: ${w.weightKg} kg`,
        desc: `BCS ${w.bcs || "—"}${w.dailyGainG ? ` · gain ${w.dailyGainG} g/day` : ""}`,
      }));
  }, [a]);

  if (isLoading) {
    return (
      <Screen title="Animal" back>
        <Loader />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen title="Animal" back>
        <ErrorState text={extractFrappeError(error)} onRetry={() => refetch()} />
      </Screen>
    );
  }

  if (!a) {
    return (
      <Screen title="Not found" back>
        <Banner tone="warning">Animal {id} not found.</Banner>
      </Screen>
    );
  }

  const age = a.dob ? ageMonths(a.dob) : null;

  return (
    <Screen
      title={a.name}
      subtitle={a.id}
      back
      onRefresh={() => refetch()}
      refreshing={isRefetching}
    >
      {a.inTreatment ? (
        <Banner tone="danger">
          In treatment · milk withdrawal until {a.milkSafe ?? "—"}
        </Banner>
      ) : null}

      <MetricGrid
        items={[
          {
            label: "Sex / age",
            value: a.sex === "F" ? "Female" : "Male",
            sub: age !== null ? `${age} months` : "",
            small: true,
          },
          { label: "Last weight", value: a.lastWt ? `${a.lastWt} kg` : "—" },
          { label: "Herd", value: a.herd || "—", small: true },
          {
            label: "Parity / DIM",
            value: `${a.parity}${a.dim !== null ? ` / ${a.dim}d` : ""}`,
            small: true,
          },
        ]}
      />

      <SectionTitle>Quick actions</SectionTitle>
      <TileGrid>
        <Tile icon="magnify" title="Diagnose" onPress={() => router.push("/(tabs)/record/events/diagnosis")} />
        {a.repro === "Calf" ? (
          <>
            <Tile icon="baby-bottle-outline" title="Feed" onPress={() => router.push("/(tabs)/record/events/calf-feed")} />
            <Tile icon="scale" title="Weigh" onPress={() => router.push("/(tabs)/record/events/weight")} />
            <Tile icon="arrow-left-right" title="Move" onPress={() => router.push("/(tabs)/record/events/movement")} />
          </>
        ) : (
          <>
            <Tile icon="needle" title="Vaccinate" onPress={() => router.push("/(tabs)/record/events/vaccination")} />
            <Tile icon="heart" title="Service" onPress={() => router.push("/(tabs)/record/events/service")} />
            <Tile icon="arrow-left-right" title="Move" onPress={() => router.push("/(tabs)/record/events/movement")} />
          </>
        )}
      </TileGrid>

      <SectionTitle>Weight history</SectionTitle>
      {timeline.length ? (
        <Timeline events={timeline} />
      ) : (
        <Banner tone="info">No weight records yet.</Banner>
      )}

      <Button label="View full history" variant="outline" />
    </Screen>
  );
}
