import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Banner } from "@/components/Banner";
import { Divider } from "@/components/Divider";
import { ErrorState } from "@/components/ErrorState";
import { KV } from "@/components/KV";
import { Loader } from "@/components/Loader";
import { MetricGrid } from "@/components/MetricGrid";
import { Pill } from "@/components/Pill";
import { Row } from "@/components/Row";
import { Screen } from "@/components/Screen";
import { COLORS, FONT_FAMILY } from "@/constants/theme";
import { useAnimals } from "@/src/hooks/useAnimals";
import {
  useAllHealthCases,
  useEventsLast365d,
  useMilkLast30d,
} from "@/src/hooks/useReports";
import { extractFrappeError } from "@/src/services/api";

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={s.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Milk yield — last 30 days
// ---------------------------------------------------------------------------

function MilkYield() {
  const { data: rows = [], isLoading, isRefetching, error, refetch } = useMilkLast30d();

  const { totalKg, revenue, discarded, byHerd } = useMemo(() => {
    let totalKg = 0;
    let revenue = 0;
    let discarded = 0;
    const byHerd: Record<string, number> = {};
    for (const r of rows) {
      totalKg += r.netYieldKg;
      revenue += r.milkRevenue;
      discarded += r.discardedKg;
      byHerd[r.herd] = (byHerd[r.herd] ?? 0) + r.netYieldKg;
    }
    return { totalKg, revenue, discarded, byHerd };
  }, [rows]);

  // Days with at least one recording, used to compute per-cow heuristic.
  const distinctDays = useMemo(
    () => new Set(rows.map((r) => r.recordingDate)).size || 1,
    [rows],
  );
  const discardPct = totalKg + discarded > 0 ? (discarded / (totalKg + discarded)) * 100 : 0;

  return (
    <Screen title="Milk yield" subtitle="Last 30 days" back onRefresh={refetch} refreshing={isRefetching}>
      {isLoading ? (
        <Loader />
      ) : error ? (
        <ErrorState text={extractFrappeError(error)} onRetry={refetch} />
      ) : (
        <>
          <SectionHeader title="Overview" subtitle="Production, revenue and discard summary" />
          <MetricGrid
            items={[
              { label: "30d net yield", value: Math.round(totalKg).toLocaleString(), sub: "kg" },
              { label: "Days recorded", value: String(distinctDays), sub: rows.length === 1 ? "session" : `${rows.length} sessions` },
              { label: "Revenue", value: Math.round(revenue).toLocaleString(), sub: "KES" },
              { label: "Discarded", value: Math.round(discarded).toLocaleString(), sub: `kg, ${discardPct.toFixed(1)}%` },
            ]}
          />

          <Divider />

          <SectionHeader title="By herd" subtitle="Total kg over the last 30 days" />
          {Object.keys(byHerd).length === 0 ? (
            <Banner tone="info">No milk recordings in the last 30 days.</Banner>
          ) : (
            Object.entries(byHerd)
              .sort(([, a], [, b]) => b - a)
              .map(([herd, kg]) => (
                <KV key={herd} k={herd} v={`${Math.round(kg).toLocaleString()} kg`} />
              ))
          )}
        </>
      )}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Reproduction — last 12 months
// ---------------------------------------------------------------------------

function Reproduction() {
  const events = useEventsLast365d();
  const animals = useAnimals();

  const isLoading = events.isLoading || animals.isLoading;
  const error = events.error || animals.error;
  const refetch = () => {
    events.refetch();
    animals.refetch();
  };

  const stats = useMemo(() => {
    const all = events.data ?? [];
    const services = all.filter((e) => e.eventType === "Service");
    const pds = all.filter((e) => e.eventType === "Pregnancy Diagnosis");
    const calvings = all.filter((e) => e.eventType === "Calving" || e.eventType === "Birth");
    const confirmedPDs = pds.filter((e) => e.diagnosisResult === "Confirmed").length;
    const conception = pds.length > 0 ? (confirmedPDs / pds.length) * 100 : 0;
    return { services, pds, calvings, conception };
  }, [events.data]);

  // Cows served > 50 days ago without a subsequent PD or Calving event.
  const overdue = useMemo(() => {
    const all = events.data ?? [];
    const fiftyDaysAgo = Date.now() - 50 * 86_400_000;
    const out: { animal: string; service: string; daysAgo: number }[] = [];
    const byAnimal: Record<string, typeof all> = {};
    for (const e of all) (byAnimal[e.animal] ||= []).push(e);
    for (const [animal, rows] of Object.entries(byAnimal)) {
      const sorted = rows.slice().sort((a, b) => (a.eventDate < b.eventDate ? 1 : -1));
      const lastService = sorted.find((e) => e.eventType === "Service");
      if (!lastService) continue;
      const serviceTime = Date.parse(lastService.eventDate);
      if (Number.isNaN(serviceTime) || serviceTime > fiftyDaysAgo) continue;
      const laterPD = sorted.find(
        (e) =>
          (e.eventType === "Pregnancy Diagnosis" || e.eventType === "Calving" || e.eventType === "Birth") &&
          e.eventDate > lastService.eventDate,
      );
      if (!laterPD) {
        out.push({
          animal,
          service: lastService.eventDate,
          daysAgo: Math.floor((Date.now() - serviceTime) / 86_400_000),
        });
      }
    }
    return out.sort((a, b) => b.daysAgo - a.daysAgo).slice(0, 20);
  }, [events.data]);

  return (
    <Screen title="Reproduction" subtitle="Last 12 months" back onRefresh={refetch}>
      {isLoading ? (
        <Loader />
      ) : error ? (
        <ErrorState text={extractFrappeError(error)} onRetry={refetch} />
      ) : (
        <>
          <SectionHeader title="Performance" subtitle="Counts from Animal Event timeline" />
          <MetricGrid
            items={[
              { label: "Services", value: String(stats.services.length), sub: "12m" },
              { label: "PDs done", value: String(stats.pds.length), sub: "12m" },
              { label: "Calvings", value: String(stats.calvings.length), sub: "12m" },
              { label: "Conception", value: `${stats.conception.toFixed(0)}%`, sub: "of PDs" },
            ]}
          />

          <Divider />

          <SectionHeader title="Open events" subtitle="Served > 50 days ago, no PD on record" />
          {overdue.length === 0 ? (
            <Banner tone="info">All served cows have follow-up events.</Banner>
          ) : (
            overdue.map((o) => (
              <Row
                key={o.animal}
                left={<Avatar icon="clock-outline" tone="warning" />}
                title={o.animal}
                meta={`Served ${o.service} · ${o.daysAgo}d ago`}
                right={<Pill label="PD overdue" tone="warning" />}
              />
            ))
          )}
        </>
      )}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Health & costs
// ---------------------------------------------------------------------------

function HealthCosts() {
  const cases = useAllHealthCases();
  const events = useEventsLast365d();

  const isLoading = cases.isLoading || events.isLoading;
  const error = cases.error || events.error;
  const refetch = () => {
    cases.refetch();
    events.refetch();
  };

  const stats = useMemo(() => {
    const allCases = cases.data ?? [];
    const allEvents = events.data ?? [];
    const treatmentEventSpend = allEvents
      .filter((e) =>
        ["Vaccination", "Deworming", "Dehorning", "Hoof Trimming"].includes(e.eventType),
      )
      .reduce((a, e) => a + e.activityCost, 0);
    const caseSpend = allCases.reduce((a, c) => a + c.totalTreatmentCost, 0);
    const totalSpend = treatmentEventSpend + caseSpend;
    const avgPerCase = allCases.length ? caseSpend / allCases.length : 0;
    return { allCases, totalSpend, caseSpend, treatmentEventSpend, avgPerCase };
  }, [cases.data, events.data]);

  // Cost grouped by presenting symptom (best proxy for "by condition" until
  // confirmed_diagnosis is populated consistently).
  const byCondition = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of cases.data ?? []) {
      const key = (c.presentingSymptoms || "Other").slice(0, 32);
      map[key] = (map[key] ?? 0) + c.totalTreatmentCost;
    }
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 8);
  }, [cases.data]);

  // Top-spending animals across cases.
  const topSpenders = useMemo(() => {
    const map: Record<string, { animalName: string; total: number; count: number }> = {};
    for (const c of cases.data ?? []) {
      const m = map[c.animal] || { animalName: c.animalName, total: 0, count: 0 };
      m.total += c.totalTreatmentCost;
      m.count += 1;
      map[c.animal] = m;
    }
    return Object.entries(map)
      .map(([animal, v]) => ({ animal, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [cases.data]);

  return (
    <Screen title="Health & costs" subtitle="Last 12 months" back onRefresh={refetch}>
      {isLoading ? (
        <Loader />
      ) : error ? (
        <ErrorState text={extractFrappeError(error)} onRetry={refetch} />
      ) : (
        <>
          <SectionHeader title="Spending overview" subtitle="Aggregated from cases + events" />
          <MetricGrid
            items={[
              { label: "Total spend", value: Math.round(stats.totalSpend).toLocaleString(), sub: "KES" },
              { label: "Cases", value: String(stats.allCases.length), sub: "12m" },
              { label: "Avg / case", value: Math.round(stats.avgPerCase).toLocaleString(), sub: "KES" },
              { label: "Event cost", value: Math.round(stats.treatmentEventSpend).toLocaleString(), sub: "vacc + deworm + ..." },
            ]}
          />

          <Divider />

          <SectionHeader title="By condition" subtitle="Where the case spend is going" />
          {byCondition.length === 0 ? (
            <Banner tone="info">No health cases recorded.</Banner>
          ) : (
            byCondition.map(([cond, kes]) => (
              <KV key={cond} k={cond} v={`${Math.round(kes).toLocaleString()} KES`} />
            ))
          )}

          <Divider />

          <SectionHeader title="Top spenders" subtitle="Highest treatment cost across cases" />
          {topSpenders.length === 0 ? (
            <Banner tone="info">No data yet.</Banner>
          ) : (
            topSpenders.map((sp) => (
              <Row
                key={sp.animal}
                left={<Avatar icon="stethoscope" tone="danger" />}
                title={sp.animalName}
                meta={`${sp.count} case${sp.count === 1 ? "" : "s"} · ${Math.round(sp.total).toLocaleString()} KES`}
              />
            ))
          )}
        </>
      )}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Calf growth
// ---------------------------------------------------------------------------

function CalfGrowth() {
  const animals = useAnimals();

  // Use the existing animals list (already has lastWt + dob). For a richer
  // ADG calc we'd fetch each animal's weight_history; this report uses the
  // simple (last_weight - birth_weight) / days_since_birth proxy from the
  // list-level data. Anything more accurate is a per-animal query.
  const stats = useMemo(() => {
    const list = animals.data ?? [];
    const youngstock = list.filter((a) => a.repro === "Calf" || a.repro === "Heifer");
    return { youngstock };
  }, [animals.data]);

  return (
    <Screen title="Calf growth" subtitle="Youngstock 0–12 months" back onRefresh={animals.refetch}>
      {animals.isLoading ? (
        <Loader />
      ) : animals.error ? (
        <ErrorState text={extractFrappeError(animals.error)} onRetry={animals.refetch} />
      ) : stats.youngstock.length === 0 ? (
        <Banner tone="info">No youngstock on record.</Banner>
      ) : (
        <>
          <SectionHeader title="Population" subtitle="Calves + heifers in the system" />
          <MetricGrid
            items={[
              { label: "Total", value: String(stats.youngstock.length), sub: "head" },
              {
                label: "Median weight",
                value: medianWeight(stats.youngstock.map((a) => a.lastWt).filter(Boolean) as number[]).toLocaleString(),
                sub: "kg",
              },
            ]}
          />

          <Divider />

          <SectionHeader title="Roster" subtitle="Youngstock with current weight" />
          {stats.youngstock.slice(0, 30).map((a) => (
            <Row
              key={a.id}
              left={<Avatar icon="cow" />}
              title={`${a.name} · ${a.id}`}
              meta={`${a.herd}${a.lastWt ? ` · ${a.lastWt} kg` : ""}`}
            />
          ))}
        </>
      )}
    </Screen>
  );
}

const medianWeight = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const sorted = xs.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

// ---------------------------------------------------------------------------

function UnknownReport() {
  return (
    <Screen title="Report" back>
      <View style={s.empty}>
        <MaterialCommunityIcons name="file-question-outline" size={48} color={COLORS.textSubtle} />
        <Text style={s.emptyText}>Unknown report.</Text>
      </View>
    </Screen>
  );
}

export default function Report() {
  const { type } = useLocalSearchParams<{ type: string }>();
  if (type === "milk") return <MilkYield />;
  if (type === "repro") return <Reproduction />;
  if (type === "health") return <HealthCosts />;
  if (type === "growth") return <CalfGrowth />;
  return <UnknownReport />;
}

const s = StyleSheet.create({
  sectionHeader: {
    marginTop: 4,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    color: COLORS.text,
    fontFamily: FONT_FAMILY.semibold,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.regular,
    marginTop: 3,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.regular,
    textAlign: "center",
  },
});
