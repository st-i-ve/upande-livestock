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
import { useAnimalEvents } from "@/src/hooks/useAnimalEvents";
import type { TimelineEvent } from "@/components/Timeline";

export function AnimalDetail({ id }: { id: string }) {
  const { data: a, isLoading, isRefetching, error, refetch } = useAnimal(id);
  const {
    data: events,
    isLoading: eventsLoading,
    error: eventsError,
    refetch: refetchEvents,
  } = useAnimalEvents(id);

  // Timeline is built from Livestock Event — the doctype every submitted
  // event (movement, service, diagnosis, calving, vaccination, ...) lands in.
  // Weighings are a separate doctype and Animal.weight_history does not exist
  // on the server, so neither feeds this list.
  const timeline: TimelineEvent[] = useMemo(() => {
    if (!events) return [];
    return events.map((e) => ({
      date: e.eventDate,
      title: e.eventType,
      desc:
        e.diagnosisResult != null
          ? `Result: ${e.diagnosisResult}`
          : e.newHerd
            ? `New herd: ${e.newHerd}`
            : e.currentHerd
              ? `Herd: ${e.currentHerd}`
              : undefined,
      isBackdated: e.isBackdated || undefined,
      feedMode: e.feedMode,
    }));
  }, [events]);

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
          ...(a.insuredValue > 0
            ? [{
                label: "Insured value",
                value: `KES ${a.insuredValue.toLocaleString()}`,
                small: true,
              }]
            : []),
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

      <SectionTitle>History</SectionTitle>
      {eventsLoading ? (
        <Loader />
      ) : eventsError ? (
        <ErrorState
          text={extractFrappeError(eventsError)}
          onRetry={() => refetchEvents()}
        />
      ) : timeline.length ? (
        <Timeline events={timeline} />
      ) : (
        <Banner tone="info">No recorded events yet.</Banner>
      )}

      <Button label="View full history" variant="outline" />
    </Screen>
  );
}
