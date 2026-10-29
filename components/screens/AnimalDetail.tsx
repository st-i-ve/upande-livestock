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
import type { AnimalProfile } from "@/src/frappe/animal";
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
  // knows: the stage, the breeding note and any treatment.
  const local = useLocalAnimal(id);
  const online = useAnimal(id);
  const profileQ = useAnimalProfile(id);
  const profile = profileQ.data ?? null;
  const gallery = useAnimalGallery(id).data?.photos ?? [];
  const [viewing, setViewing] = useState<number | null>(null);
  const a = local.data
    ? {
        ...local.data,
        inTreatment: online.data?.inTreatment ?? 0,
        stream: online.data?.stream ?? null,
        breedingNote: online.data?.breedingNote ?? null,
        breedingNoteBy: online.data?.breedingNoteBy ?? null,
        breedingNoteOn: online.data?.breedingNoteOn ?? null,
      }
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
        e.eventType === "Movement" && e.remarks
          ? `${e.newHerd ? `To ${e.newHerd}: ` : ""}${e.remarks}`
          : e.diagnosisResult != null
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
  type Action = { label: string; route: string; icon: keyof typeof MaterialCommunityIcons.glyphMap };
  // Weight is the first thing a herdsman does with an animal, so it comes first.
  const actions: Action[] = [
    { label: "Weigh", route: "weight", icon: "scale" },
    { label: "Check up", route: "diagnosis", icon: "magnify" },
    ...(isFemaleAdult ? [{ label: "Service", route: "service", icon: "heart" } as Action] : []),
    { label: "Treat", route: "treatment", icon: "medical-bag" },
    ...(isFemaleAdult ? [{ label: "PD", route: "pd", icon: "stethoscope" } as Action] : []),
    { label: "Vaccinate", route: "vaccination", icon: "needle" },
    { label: "Deworm", route: "deworming", icon: "bug-outline" },
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
          Under treatment
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

      <WeightSection
        lastWt={a.lastWt}
        profile={profile}
        canRecord={canRecord}
        onWeigh={() => router.push(`/(tabs)/animals/act/weight?animal=${encodeURIComponent(id)}` as never)}
      />

      <View style={s.facts}>
        <Fact label="Sex" value={a.sex === "M" ? "Male" : "Female"} />
        <Fact label="Breed" value={a.breed || profile?.breed || "—"} />
        <Fact label="Dam" value={a.dam || "—"} />
        <Fact label="Sire" value={a.sire || "—"} />
        <Fact label="Parity" value={String(a.parity ?? 0)} />
        {a.stream ? <Fact label="Stream" value={a.stream} /> : null}
      </View>

      {a.breedingNote ? (
        <>
          <SectionTitle>Breeding note</SectionTitle>
          <View style={s.note} testID="breeding-note">
            <Text style={s.noteText}>{a.breedingNote}</Text>
            <Text style={s.noteMeta}>
              {[a.breedingNoteBy, a.breedingNoteOn].filter(Boolean).join(" · ") || "Selection move"}
            </Text>
          </View>
        </>
      ) : null}

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

/** The first section on the page: last weight, gain against target, and the Weigh button. */
function WeightSection({
  lastWt,
  profile,
  canRecord,
  onWeigh,
}: {
  lastWt: number;
  profile: AnimalProfile | null;
  canRecord: boolean;
  onWeigh: () => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const gain = profile?.gain;
  const last = gain?.trend?.length ? gain.trend[gain.trend.length - 1] : null;
  const adg = gain?.herd_adg ?? gain?.lifetime_adg ?? null;
  return (
    <View style={s.weightBox} testID="weight-section">
      <View style={{ flex: 1 }}>
        <Text style={s.weightLabel}>Weight</Text>
        <Text style={s.weightValue}>{lastWt ? `${lastWt} kg` : "Not weighed"}</Text>
        <Text style={s.weightMeta}>
          {[
            last ? `on ${last.date}` : null,
            adg != null ? `${adg.toFixed(2)} kg/day${gain?.target_adg_kg ? ` (target ${gain.target_adg_kg})` : ""}` : null,
          ].filter(Boolean).join(" · ") || "No gain figure yet"}
        </Text>
      </View>
      {canRecord ? <Button label="Weigh" icon="scale" onPress={onWeigh} /> : null}
    </View>
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
    weightBox: {
      flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginBottom: 12,
      borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgMuted,
    },
    weightLabel: { fontSize: 10, ...font("500"), letterSpacing: 1, textTransform: "uppercase", color: c.textSubtle },
    weightValue: { fontSize: 26, ...font("700"), color: c.text },
    weightMeta: { fontSize: 12, color: c.textMuted },
    note: { padding: 12, borderRadius: 12, backgroundColor: c.bgMuted, marginBottom: 12, gap: 4 },
    noteText: { fontSize: 14, lineHeight: 20, color: c.text },
    noteMeta: { fontSize: 11, color: c.textSubtle },
    actions: { gap: 14, paddingVertical: 4, paddingRight: 8 },
    action: { alignItems: "center", width: 64, gap: 5 },
    actionCircle: {
      width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center",
      backgroundColor: c.bgMuted, borderWidth: 1, borderColor: c.borderSubtle,
    },
    actionLabel: { fontSize: 11, color: c.textMuted },
  });
