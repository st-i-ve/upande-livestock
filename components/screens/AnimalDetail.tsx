import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { font } from "@/constants/theme";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { Loader } from "@/components/Loader";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { StandingSection } from "@/components/StandingSection";
import { Timeline } from "@/components/Timeline";
import { AnimalImage } from "@/components/AnimalImage";
import { AnimalPhotos, Viewer } from "@/components/AnimalPhotos";
import { STAGE_LABELS, ageFrom } from "@/services/utils";
import { kindOf } from "@/src/animalKind";
import { extractFrappeError } from "@/src/services/api";
import { useAnimal, useAnimalProfile } from "@/src/hooks/useAnimal";
import { useLocalAnimal } from "@/src/hooks/useLocalAnimal";
import { useAnimalGallery } from "@/src/hooks/useAnimalGallery";
import { useCanRecord } from "@/src/hooks/useCanRecord";
import { useColors } from "@/src/hooks/useColors";
import { useAnimalEvents } from "@/src/hooks/useAnimalEvents";
import type { TimelineEvent } from "@/components/Timeline";

export function AnimalDetail({ id }: { id: string }) {
  const { canRecord } = useCanRecord();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  // The local copy answers first (and offline); the server adds what only it
  // knows: her stage, days in milk and any treatment.
  const local = useLocalAnimal(id);
  const online = useAnimal(id);
  const profileQ = useAnimalProfile(id);
  const profile = profileQ.data ?? null;
  const gallery = useAnimalGallery(id).data?.photos ?? [];
  const [viewing, setViewing] = useState<number | null>(null);
  const a = local.data
    ? { ...local.data, inTreatment: online.data?.inTreatment ?? 0, milkSafe: online.data?.milkSafe ?? null }
    : (online.data ?? null);
  // The stored stage answers offline; the live profile, when there is one, wins.
  const stage = profile?.stage ?? local.data?.stage ?? null;
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

  const kind = kindOf({ ...a, stage });
  const isFemaleAdult = kind === "cow" || kind === "heifer";
  // In calf and milking: she has calved (so she is a cow, not an in-calf heifer).
  const lactating = (a.parity ?? 0) > 0 || profile?.cycle.daysInMilk != null;
  type Action = { label: string; route: string; icon: keyof typeof MaterialCommunityIcons.glyphMap };
  const actions: Action[] = [
    { label: "Check up", route: "diagnosis", icon: "magnify" },
    ...(isFemaleAdult ? [{ label: "Service", route: "service", icon: "heart" } as Action] : []),
    { label: "Treat", route: "treatment", icon: "medical-bag" },
    ...(isFemaleAdult && stage === "served" ? [{ label: "PD", route: "pd", icon: "stethoscope" } as Action] : []),
    ...(isFemaleAdult && stage === "confirmed" && lactating
      ? [{ label: "Dry off", route: "dryoff", icon: "water-off" } as Action]
      : []),
    { label: "Vaccinate", route: "vaccination", icon: "needle" },
    { label: "Deworm", route: "deworming", icon: "bug-outline" },
    { label: "Weigh", route: "weight", icon: "scale" },
    { label: "Move", route: "movement", icon: "arrow-left-right" },
  ];

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

      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel="Open her photos"
        disabled={!gallery.length}
        onPress={() => {
          const mine = a.image ?? profile?.photo;
          const i = mine ? gallery.findIndex((p) => p.url === mine) : -1;
          setViewing(i >= 0 ? i : 0);
        }}
        style={s.hero}
      >
        <AnimalImage image={a.image ?? profile?.photo} animal={{ ...a, stage }} style={s.heroPhoto} />
        <View style={s.heroShade}>
          <Text style={s.heroName} numberOfLines={1}>{a.name}</Text>
          <Text style={s.heroId} numberOfLines={1}>{a.id}</Text>
          <View style={s.heroRow}>
            {stage ? (
              <View style={s.heroBadge}>
                <Text style={s.heroBadgeText}>{STAGE_LABELS[stage] ?? stage}</Text>
              </View>
            ) : null}
            <Text style={s.heroMeta} numberOfLines={1}>
              {ageFrom(a.dob)} · {a.herd || "no herd"}
            </Text>
          </View>
        </View>
      </Pressable>
      {viewing !== null && gallery.length ? (
        <Viewer photos={gallery} start={viewing} onClose={() => setViewing(null)} />
      ) : null}

      <View style={s.facts}>
        <Fact label="Sex" value={a.sex === "M" ? "Male" : "Female"} />
        <Fact label="Breed" value={a.breed || profile?.breed || "—"} />
        <Fact label="Dam" value={a.dam || "—"} />
        <Fact label="Sire" value={a.sire || "—"} />
        <Fact label="Parity" value={String(a.parity ?? 0)} />
        <Fact label="Weight" value={a.lastWt ? `${a.lastWt} kg` : "—"} />
        {profile?.cycle.daysInMilk != null ? (
          <Fact label="Days in milk" value={`${profile.cycle.daysInMilk}`} />
        ) : null}
      </View>

      {canRecord && actions.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.actions}>
          {actions.map((x) => (
            <Pressable
              key={x.label}
              accessibilityRole="button"
              accessibilityLabel={x.label}
              onPress={() => router.push(`/(tabs)/animals/act/${x.route}?animal=${encodeURIComponent(id)}` as never)}
              style={s.action}
            >
              <View style={s.actionCircle}>
                <MaterialCommunityIcons name={x.icon} size={22} color={c.text} />
              </View>
              <Text style={s.actionLabel} numberOfLines={1}>{x.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <AnimalPhotos id={id} isCalf={kind === "calf"} hasCalved={isFemaleAdult && (a.parity ?? 0) > 0} />

      <StandingSection id={id} />

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
    <View style={{ width: "50%", paddingVertical: 3, paddingRight: 6 }}>
      <Text style={{ fontSize: 9, ...font("500"), letterSpacing: 1, textTransform: "uppercase", color: c.textSubtle }}>
        {label}
      </Text>
      <Text style={{ fontSize: 13, color: c.text }} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    hero: { width: "100%", aspectRatio: 4 / 3, borderRadius: 20, overflow: "hidden", marginBottom: 12, backgroundColor: c.bgMuted },
    heroPhoto: { width: "100%", height: "100%" },
    heroShade: {
      position: "absolute", left: 0, right: 0, bottom: 0, padding: 14, paddingTop: 36,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    heroName: { fontSize: 24, ...font("700"), color: "#fff" },
    heroId: { fontSize: 12, color: "rgba(255,255,255,0.8)", ...font("400") },
    heroRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
    heroBadge: { borderWidth: 1, borderColor: "rgba(255,255,255,0.7)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 1 },
    heroBadgeText: { fontSize: 11, ...font("600"), color: "#fff", textTransform: "uppercase", letterSpacing: 0.8 },
    heroMeta: { flexShrink: 1, fontSize: 13, color: "#fff" },
    facts: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
    actions: { gap: 14, paddingVertical: 4, paddingRight: 8 },
    action: { alignItems: "center", width: 64, gap: 5 },
    actionCircle: {
      width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center",
      backgroundColor: c.bgMuted, borderWidth: 1, borderColor: c.borderSubtle,
    },
    actionLabel: { fontSize: 11, color: c.textMuted },
  });
