import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { ResultChip } from "@/components/ResultChip";
import { Loader } from "@/components/Loader";
import { useOffline } from "@/components/OnlineOnlyNotice";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { RADIUS, font } from "@/constants/theme";
import { useAuthStore } from "@/src/auth/authStore";
import { isQualityOnly } from "@/src/auth/roles";
import {
  METRICS,
  formatMetric,
  getFeedQuality,
  getQualityOptions,
  type HerdFeedQuality,
  type Metric,
} from "@/src/frappe/quality";
import { useColors } from "@/src/hooks/useColors";
import { extractFrappeError } from "@/src/services/api";
import { pendingFirst } from "@/src/frappe/milkBatchLabel";
import { getMilkBatches } from "@/src/frappe/milkBatches";
import { getQualityTests } from "@/src/frappe/milkQualityTest";
import { CHECK_LABELS, type CheckKey } from "@/src/frappe/milkQualityRules";

const CHECKS = Object.keys(CHECK_LABELS) as CheckKey[];
const fmt = (n: number | null | undefined) => (n == null ? "—" : String(Math.round(n * 100) / 100));

type Segment = "milk" | "feed";

/**
 * Quality, the lab role's one view (and a Record-menu entry for managers).
 *
 * Two segments mirroring the web: Milk quality (the one result form, recorded
 * against a milked batch) and Feed quality (each herd's milk quality beside its ration,
 * read-only). Online only: every figure is read from, or filed to, the server.
 */
export default function Quality() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const offline = useOffline();
  const qualityOnly = isQualityOnly(useAuthStore((st) => st.roles));
  const [segment, setSegment] = useState<Segment>("milk");

  return (
    <Screen title="Quality" subtitle="Milk quality and feed" back={!qualityOnly}>
      {offline ? (
        <Banner tone="warning" icon="wifi-off">
          No connection. Figures you enter are kept on this phone and sent when you are back online; the lists below need a connection.
        </Banner>
      ) : null}
      <View style={s.segments}>
        <Chips>
          <Chip label="Milk quality" active={segment === "milk"} onPress={() => setSegment("milk")} />
          <Chip label="Feed quality" active={segment === "feed"} onPress={() => setSegment("feed")} />
        </Chips>
      </View>
      <Button label="Record a buyer's quality result" onPress={() => router.push("/lab/record" as any)} />
      {segment === "milk" ? <MilkQuality offline={offline} /> : <FeedQuality />}
    </Screen>
  );
}

function MilkQuality({ offline }: { offline: boolean }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const q = useQuery({ queryKey: ["quality-options"], queryFn: () => getQualityOptions(60) });
  const batchesQ = useQuery({ queryKey: ["milk-batches"], queryFn: () => getMilkBatches(), enabled: !offline, staleTime: 60_000 });
  const history = useQuery({ queryKey: ["quality-tests"], queryFn: () => getQualityTests({}, 15), enabled: !offline });
  const data = q.data;

  // The same form records every result: tapping a batch opens it with that batch picked.
  const waiting = pendingFirst(batchesQ.data ?? []).filter((b) => b.pending);
  const tests = history.data?.tests ?? [];
  const flagged = tests.filter((t) => t.scc_over_ceiling).length;

  if (q.isLoading) return <Loader />;
  if (q.error) return <Banner tone="danger">{extractFrappeError(q.error)}</Banner>;
  if (!data) return null;

  return (
    <View>
      <Banner tone="info">
        {data.mode === "At milking"
          ? "This farm records quality at milking. What is listed as awaiting was left blank at the time, or came in from a handset."
          : "This farm records quality afterwards. Every milking arrives here for its figures."}
        {data.required_in_lab
          ? " A batch stays awaiting until a figure is entered."
          : " Nothing is chased — the list is for reference."}
      </Banner>

      <View style={s.figures}>
        <Figure label="Awaiting quality" value={String(data.pending.length)} hint="recordings, last 60 days" />
        <Figure label="Filed" value={String(data.recent.length)} hint="last 60 days" />
        <Figure
          label="Over the ceiling"
          value={String(Math.max(data.recent.filter((r) => r.over_ceiling).length, flagged))}
          hint={data.scc_ceiling ? `above ${fmt(data.scc_ceiling)} × 1000 cells/ml` : "no ceiling set"}
        />
      </View>

      <SectionTitle>Awaiting a result</SectionTitle>
      {offline ? (
        <Text style={s.empty}>The list needs a connection. You can still record a result from the button above.</Text>
      ) : !waiting.length ? (
        <Text style={s.empty}>{batchesQ.isLoading ? "Loading…" : "Nothing outstanding. Every recent batch has its figures."}</Text>
      ) : (
        waiting.map((b) => (
          <Pressable
            key={b.key}
            style={s.row}
            onPress={() => router.push({ pathname: "/lab/record", params: { batch: b.key } } as any)}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{b.date} · {b.shift}</Text>
              <Text style={s.meta}>{b.herds.join(", ")}</Text>
            </View>
            <Text style={s.meta}>{fmt(b.total_kg)} kg</Text>
          </Pressable>
        ))
      )}

      <SectionTitle>Results</SectionTitle>
      <Text style={s.hint}>One row per batch test, newest first.</Text>
      {offline ? (
        <Text style={s.empty}>History needs a connection.</Text>
      ) : !tests.length ? (
        <Text style={s.empty}>{history.isLoading ? "Loading…" : "Nothing recorded yet."}</Text>
      ) : (
        tests.map((t) => (
          <View key={t.name} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>
                {t.sample_date}{t.shift ? ` · ${t.shift}` : ""} · {t.sample_type}
              </Text>
              <Text style={[s.meta, t.scc_over_ceiling && { color: c.danger, ...font("700") }]}>
                SCC {t.bulk_scc ? fmt(t.bulk_scc) : "—"}
                {t.scc_over_ceiling ? " (over ceiling)" : ""}
                <Text style={{ color: c.textMuted, ...font("400") }}>
                  {" "}· Fat {fmt(t.butterfat_percent)}% · Protein {fmt(t.protein_percent)}%
                </Text>
              </Text>
              <View style={s.chips}>
                {CHECKS.map((k) => (
                  <ResultChip key={k} label={CHECK_LABELS[k]} chip={t.checks[k]} />
                ))}
              </View>
            </View>
            <Text style={[s.num, t.overall_result === "Fail" && { color: c.danger, ...font("700") }]}>{t.overall_result}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function FeedQuality() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [days, setDays] = useState(90);
  const [metric, setMetric] = useState<Metric>("fat");
  const q = useQuery({ queryKey: ["feed-quality", days], queryFn: () => getFeedQuality(days) });
  const data = q.data;

  return (
    <View>
      <Text style={s.hint}>
        Each milking herd&rsquo;s milk quality beside what it is fed — set against the other herds, so a ration trial
        shows whether the new recipe is paying off.
      </Text>
      <Chips>
        {(data?.windows ?? [30, 90, 150]).map((w) => (
          <Chip key={w} label={`Last ${w} days`} active={days === w} onPress={() => setDays(w)} />
        ))}
      </Chips>
      {data ? (
        <Text style={s.hint}>
          {data.from_date} to {data.to_date}
        </Text>
      ) : null}
      {q.isLoading ? <Loader /> : null}
      {q.error ? <Banner tone="danger">{extractFrappeError(q.error)}</Banner> : null}
      {data ? (
        <>
          {data.herds.map((h) => (
            <HerdCard key={h.herd} h={h} />
          ))}
          <SectionTitle>{METRICS[metric].label} by week</SectionTitle>
          <Text style={s.hint}>
            The average of each week&rsquo;s milkings, per herd
            {METRICS[metric].better === "lower" ? " — lower is better" : ""}.
          </Text>
          <Chips>
            {(Object.keys(METRICS) as Metric[]).map((k) => (
              <Chip key={k} label={METRICS[k].label} active={metric === k} onPress={() => setMetric(k)} />
            ))}
          </Chips>
          {data.weeks.length === 0 ? (
            <Text style={s.empty}>No milkings with lab figures in this window.</Text>
          ) : (
            data.weeks.map((w) => (
              <View key={w.week} style={s.weekBlock}>
                <Text style={s.name}>Week starting {w.week}</Text>
                {data.herds.map((h) => (
                  <View key={h.herd} style={s.weekRow}>
                    <Text style={s.meta}>{h.herd}</Text>
                    <Text style={s.num}>{formatMetric(metric, w.herds[h.herd]?.[metric])}</Text>
                  </View>
                ))}
              </View>
            ))
          )}
        </>
      ) : null}
    </View>
  );
}

function Delta({ metric, pct }: { metric: Metric; pct: number | null }) {
  const c = useColors();
  if (pct == null) return <Text style={{ fontSize: 11, color: c.textSubtle }}>no other herd to compare</Text>;
  const up = pct >= 0;
  const better = METRICS[metric].better === "higher" ? up : !up;
  return (
    <Text style={{ fontSize: 11, color: c.textMuted }}>
      {up ? "▲ +" : "▼ −"}
      {Math.abs(pct).toFixed(1)}% vs other herds · {better ? "better" : "worse"}
    </Text>
  );
}

function HerdCard({ h }: { h: HerdFeedQuality }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const r = h.ration;
  return (
    <View style={s.card}>
      <Text style={s.formTitle}>{h.herd}</Text>
      <Text style={s.meta}>
        {h.cows} cows · {h.quality.milkings} milkings, {h.quality.readings} with lab figures
      </Text>
      <Text style={[s.label, { marginTop: 10 }]}>RATION</Text>
      {r ? (
        <>
          <Text style={s.name}>{r.name}</Text>
          <Text style={s.meta}>
            {fmt(r.per_head)} {r.uom} a head a day
            {r.concentrate_share != null &&
              ` · ${Math.round(r.concentrate_share * 100)}% concentrate (${fmt(r.concentrate_kg)} kg)`}
          </Text>
          {r.lines.slice(0, 5).map((ln) => (
            <View key={ln.item_code} style={s.weekRow}>
              <Text style={s.meta} numberOfLines={1}>
                {ln.item_name}
                {ln.concentrate ? " · concentrate" : ""}
              </Text>
              <Text style={s.meta}>
                {fmt(ln.qty)} {ln.uom}
              </Text>
            </View>
          ))}
        </>
      ) : (
        <Text style={s.meta}>This herd has no ration recipe.</Text>
      )}
      <Text style={[s.meta, { marginTop: 4 }]}>
        {h.fed.runs
          ? `Issued in this window: ${h.fed.runs} feed run${h.fed.runs === 1 ? "" : "s"}, ${fmt(h.fed.kg)} kg`
          : "No feed runs recorded in this window"}
      </Text>
      {(["fat", "protein", "scc"] as Metric[]).map((m) => (
        <View key={m} style={{ marginTop: 8 }}>
          <Text style={s.label}>{METRICS[m].label.toUpperCase()}</Text>
          <Text style={s.big}>{formatMetric(m, h.quality[m])}</Text>
          <Delta metric={m} pct={h.vs_rest[m]} />
        </View>
      ))}
      <View style={{ marginTop: 8 }}>
        <Text style={s.label}>MILK A COW A DAY</Text>
        <Text style={s.big}>
          {h.quality.milk_per_cow_day != null ? `${fmt(h.quality.milk_per_cow_day)} kg` : "—"}
        </Text>
      </View>
    </View>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint: string }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={s.figure}>
      <Text style={s.label}>{label.toUpperCase()}</Text>
      <Text style={s.big}>{value}</Text>
      <Text style={s.meta}>{hint}</Text>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    segments: { marginBottom: 8 },
    figures: { flexDirection: "row", gap: 8, marginTop: 8 },
    figure: {
      flex: 1,
      padding: 10,
      borderRadius: RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderSubtle,
    },
    label: { fontSize: 10, color: c.textSubtle, ...font("600"), letterSpacing: 0.4 },
    big: { fontSize: 20, color: c.text, ...font("600") },
    hint: { fontSize: 11, color: c.textSubtle, lineHeight: 15, marginBottom: 6 },
    empty: { paddingVertical: 16, textAlign: "center", color: c.textSubtle, fontSize: 12 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 9,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderSubtle,
    },
    name: { fontSize: 13, color: c.text, ...font("500") },
    meta: { fontSize: 11, color: c.textMuted, marginTop: 1 },
    nums: { alignItems: "flex-end" },
    num: { fontSize: 13, color: c.text, ...font("500") },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
    form: {
      marginTop: 12,
      padding: 12,
      borderRadius: RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderSubtle,
    },
    formTitle: { fontSize: 15, color: c.text, ...font("600") },
    card: {
      marginTop: 10,
      padding: 12,
      borderRadius: RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderSubtle,
    },
    weekBlock: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle },
    weekRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginTop: 2 },
  });
