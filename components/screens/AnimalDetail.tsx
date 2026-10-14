import { router } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { Loader } from "@/components/Loader";
import { MetricGrid } from "@/components/MetricGrid";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { Tile, TileGrid } from "@/components/Tile";
import { Timeline } from "@/components/Timeline";
import { AnimalImage } from "@/components/AnimalImage";
import { STAGE_LABELS, ageFrom } from "@/services/utils";
import { extractFrappeError } from "@/src/services/api";
import { useAnimal, useAnimalProfile } from "@/src/hooks/useAnimal";
import { useLocalAnimal } from "@/src/hooks/useLocalAnimal";
import { useColors } from "@/src/hooks/useColors";
import { useAnimalEvents } from "@/src/hooks/useAnimalEvents";
import type { TimelineEvent } from "@/components/Timeline";

export function AnimalDetail({ id }: { id: string }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  // The local copy answers first (and offline); the server adds what only it
  // knows: her stage, days in milk and any treatment.
  const local = useLocalAnimal(id);
  const online = useAnimal(id);
  const profileQ = useAnimalProfile(id);
  const profile = profileQ.data ?? null;
  const a = local.data
    ? { ...local.data, inTreatment: online.data?.inTreatment ?? 0, milkSafe: online.data?.milkSafe ?? null }
    : (online.data ?? null);
  const isLoading = local.isLoading && online.isLoading;
  const error = a ? null : online.error;
  const isRefetching = online.isRefetching;
  const refetch = () => {
    online.refetch();
    profileQ.refetch();
  };
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
          Under treatment{a.milkSafe ? ` · milk safe from ${a.milkSafe}` : ""}
        </Banner>
      ) : null}

      <View style={s.portrait}>
        <AnimalImage image={a.image ?? profile?.photo} style={s.photo} iconSize={72} />
        <View style={s.caption}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.capName} numberOfLines={1}>{a.name}</Text>
            <Text style={s.capId}>{a.id}</Text>
          </View>
          {profile ? <Text style={s.stage}>{STAGE_LABELS[profile.stage] ?? profile.stage}</Text> : null}
        </View>
      </View>

      <View style={s.facts}>
        <Fact label="Age" value={ageFrom(a.dob)} />
        <Fact label="Breed" value={a.breed || profile?.breed || "—"} />
        <Fact label="Herd" value={a.herd || "no herd"} />
        <Fact label="Sex" value={a.sex === "M" ? "Male" : "Female"} />
        <Fact label="Dam" value={a.dam || "—"} />
        <Fact label="Sire" value={a.sire || "—"} />
      </View>

      <MetricGrid
        items={[
          { label: "Last weight", value: a.lastWt ? `${a.lastWt} kg` : "—" },
          {
            label: "Parity / DIM",
            value: `${a.parity}${profile?.cycle.daysInMilk != null ? ` / ${profile.cycle.daysInMilk}d` : ""}`,
            small: true,
          },
        ]}
      />

      <SectionTitle>Quick actions</SectionTitle>
      <TileGrid>
        <Tile icon="magnify" title="Check up" onPress={() => router.push("/(tabs)/record/events/diagnosis")} />
        {a.repro === "Calf" ? (
          <>
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

function Fact({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View style={{ width: "50%", paddingVertical: 6, paddingRight: 8 }}>
      <Text style={{ fontSize: 10, fontWeight: "500", letterSpacing: 1.2, textTransform: "uppercase", color: c.textSubtle }}>
        {label}
      </Text>
      <Text style={{ fontSize: 14, color: c.text }} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    portrait: { borderRadius: 14, overflow: "hidden", backgroundColor: c.bgMuted, marginBottom: 8 },
    photo: { width: "100%", aspectRatio: 4 / 3 },
    caption: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
      paddingHorizontal: 14,
      paddingBottom: 10,
      paddingTop: 28,
      backgroundColor: "rgba(10,10,10,0.55)",
    },
    capName: { fontSize: 18, fontWeight: "600", color: "#fff" },
    capId: { fontSize: 12, color: "rgba(255,255,255,0.75)" },
    stage: { fontSize: 11, fontWeight: "600", color: "#fff", textTransform: "uppercase", letterSpacing: 1 },
    facts: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  });
