import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Banner } from "@/components/Banner";
import { Chip, Chips } from "@/components/Chips";
import { DateField, fromISODate } from "@/components/DateTimeField";
import { Empty } from "@/components/Empty";
import { ErrorState } from "@/components/ErrorState";
import { Field } from "@/components/Field";
import { Loader } from "@/components/Loader";
import { OnlineOnlyNotice } from "@/components/OnlineOnlyNotice";
import { Pill } from "@/components/Pill";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { FONT_FAMILY, RADIUS } from "@/constants/theme";
import { appetiteLabel, fmtKg, signedKg, signedPct } from "@/src/feed/daySheet";
import type { ReportAnimal } from "@/src/frappe/feedActuals";
import { useDailyFeedReport } from "@/src/hooks/useFeedActuals";
import { useColors } from "@/src/hooks/useColors";
import { extractFrappeError, todayISO } from "@/src/services/api";

type Show = "all" | "below" | "above";

/** The daily feed report: what each herd was fed, and every animal's intake
 *  against plan, below or above, beside its last weight and daily gain. */
export default function FeedReport() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [date, setDate] = useState(todayISO());
  const [show, setShow] = useState<Show>("all");
  const q = useDailyFeedReport(date);
  const r = q.data;
  const animals = (r?.animals ?? []).filter((a) => show === "all" || a.appetite === show);

  return (
    <Screen title="Daily feed report" subtitle="Herds, intake and appetite" back onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <OnlineOnlyNotice />
      <Field label="Day">
        <DateField value={date} onChange={setDate} maximumDate={fromISODate(todayISO())} />
      </Field>
      {q.isLoading ? <Loader /> : null}
      {q.error ? <ErrorState text={extractFrappeError(q.error)} onRetry={q.refetch} /> : null}
      {r ? (
        <>
          <View style={s.totals}>
            <Stat k="Plan" v={fmtKg(r.totals.plannedKg)} />
            <Stat k="Fed" v={fmtKg(r.totals.actualKg)} />
            <Stat k="Below plan" v={String(r.totals.belowPlan)} />
            <Stat k="Above plan" v={String(r.totals.abovePlan)} />
            <Stat k="On plan" v={String(r.totals.onPlan)} />
          </View>

          <SectionTitle>Herds fed</SectionTitle>
          {r.herds.length === 0 ? <Empty icon="grain" text="No herd was fed this day" /> : null}
          {r.herds.map((h) => (
            <View key={h.herd} style={s.card}>
              <View style={s.row}>
                <Text style={[s.herd, { flex: 1 }]}>{h.herdName}</Text>
                {h.amended ? <Pill label="Amended" /> : null}
              </View>
              <Text style={s.meta}>{h.headCount} head: plan {fmtKg(h.plannedKg)}, fed {fmtKg(h.actualKg)}</Text>
              {h.components.map((comp) => (
                <View key={comp.itemCode} style={s.line}>
                  <Text style={[s.name, { flex: 1 }, comp.removed && { textDecorationLine: "line-through" }]} numberOfLines={1}>{comp.itemName}</Text>
                  <Text style={[s.cell, s.num]}>{fmtKg(comp.plannedKg)}</Text>
                  <Text style={[s.cell, s.num]}>{fmtKg(comp.actualKg)}</Text>
                </View>
              ))}
              {h.draftEntries.length ? <Banner tone="warning">Waiting for stock: {h.draftEntries.join(", ")}</Banner> : null}
            </View>
          ))}

          <SectionTitle>Animals</SectionTitle>
          <Chips>
            <Chip label="All" active={show === "all"} onPress={() => setShow("all")} />
            <Chip label={`Below (${r.totals.belowPlan})`} tone="danger" active={show === "below"} onPress={() => setShow("below")} />
            <Chip label={`Above (${r.totals.abovePlan})`} tone="warning" active={show === "above"} onPress={() => setShow("above")} />
          </Chips>
          <Text style={s.meta}>
            Every animal shows how far it is from plan, in kg and percent. Feed is a pen&apos;s, so this is the herd&apos;s reading beside each animal&apos;s own weight.
          </Text>
          {animals.length === 0 ? <Empty icon="cow" text="No animals to show" /> : null}
          {animals.map((a) => <AnimalLine key={a.animal} a={a} />)}
        </>
      ) : null}
    </Screen>
  );
}

function AnimalLine({ a }: { a: ReportAnimal }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={s.animal}>
      <View style={s.row}>
        <Text style={[s.name, { flex: 1 }]} numberOfLines={1}>{a.tag}</Text>
        <Pill label={appetiteLabel(a.appetite)} tone={a.appetite === "below" ? "danger" : a.appetite === "above" ? "amber" : "default"} />
      </View>
      <Text style={s.meta}>
        Plan {fmtKg(a.plannedKg)}, fed {fmtKg(a.actualKg)} ({signedKg(a.varianceKg)}, {signedPct(a.variancePct)}) ·{" "}
        {a.lastWeight === null ? "no weight" : `${fmtKg(a.lastWeight)}${a.lastWeightDate ? ` on ${a.lastWeightDate}` : ""}`} ·{" "}
        {a.adg === null ? "gain n/a" : `${a.adg.toFixed(2)} kg/day`}
      </Text>
    </View>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={s.stat}>
      <Text style={s.th}>{k}</Text>
      <Text style={s.big}>{v}</Text>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    totals: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
    stat: { flexGrow: 1, flexBasis: "45%", borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.md, padding: 10 },
    big: { fontSize: 16, color: c.text, fontFamily: FONT_FAMILY.semibold },
    th: { fontSize: 10, color: c.textMuted, textTransform: "uppercase", fontFamily: FONT_FAMILY.semibold },
    card: { borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.lg, padding: 12, marginBottom: 10, gap: 4 },
    row: { flexDirection: "row", alignItems: "center", gap: 8 },
    herd: { fontSize: 15, color: c.text, fontFamily: FONT_FAMILY.semibold },
    meta: { fontSize: 11, color: c.textMuted, marginVertical: 2 },
    line: { flexDirection: "row", gap: 6, paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle },
    name: { fontSize: 13, color: c.text },
    cell: { fontSize: 12, color: c.textMuted },
    num: { width: 74, textAlign: "right" },
    animal: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle },
  });
