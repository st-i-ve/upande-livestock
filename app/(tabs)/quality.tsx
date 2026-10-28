import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Chip, Chips } from "@/components/Chips";
import { DateField } from "@/components/DateTimeField";
import { Field, FieldRow, Input } from "@/components/Field";
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
  recordMilkQuality,
  type HerdFeedQuality,
  type Metric,
  type PendingRecording,
} from "@/src/frappe/quality";
import { useCanRecord } from "@/src/hooks/useCanRecord";
import { useColors } from "@/src/hooks/useColors";
import { extractFrappeError, todayISO } from "@/src/services/api";

const fmt = (n: number | null | undefined) => (n == null ? "—" : String(Math.round(n * 100) / 100));

type Segment = "milk" | "feed";

/**
 * Quality, the lab role's one view (and a Record-menu entry for managers).
 *
 * Two segments mirroring the web: Milk quality (bulk tank figures filed against
 * a milking) and Feed quality (each herd's milk quality beside its ration,
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
          Needs a connection — quality figures are read from and filed to the server live.
        </Banner>
      ) : null}
      <View style={s.segments}>
        <Chips>
          <Chip label="Milk quality" active={segment === "milk"} onPress={() => setSegment("milk")} />
          <Chip label="Feed quality" active={segment === "feed"} onPress={() => setSegment("feed")} />
        </Chips>
      </View>
      {segment === "milk" ? <MilkQuality offline={offline} /> : <FeedQuality />}
    </Screen>
  );
}

function MilkQuality({ offline }: { offline: boolean }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const qc = useQueryClient();
  const { canRecord } = useCanRecord();
  const q = useQuery({ queryKey: ["quality-options"], queryFn: () => getQualityOptions(60) });
  const data = q.data;

  const [picked, setPicked] = useState<string | null>(null);
  const [scc, setScc] = useState("");
  const [fat, setFat] = useState("");
  const [protein, setProtein] = useState("");
  const [testedOn, setTestedOn] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const pending = data?.pending ?? [];
  const recent = data?.recent ?? [];
  const active: PendingRecording | null = pending.find((p) => p.name === picked) ?? pending[0] ?? null;
  const flagged = recent.filter((r) => r.over_ceiling).length;
  const overCeiling = !!(data?.scc_ceiling && Number(scc) > data.scc_ceiling);
  const mayFile = canRecord && !!data?.can_write;

  const save = async () => {
    if (!active) return;
    setError(null);
    setDone(null);
    // The server's own rule, said before the round trip: one figure is enough,
    // an empty result is refused.
    const nums = { bulk_scc: scc, fat_percent: fat, protein_percent: protein };
    if (!scc && !fat && !protein) {
      setError(
        "Enter at least one figure — the bulk tank SCC, the fat or the protein. Saving an empty result would clear the chase without answering it.",
      );
      return;
    }
    if (Object.values(nums).some((v) => v !== "" && !(Number(v) >= 0))) {
      setError("Figures must be numbers, zero or more.");
      return;
    }
    setSaving(true);
    try {
      const r = await recordMilkQuality({
        recording: active.name,
        bulk_scc: scc ? Number(scc) : undefined,
        fat_percent: fat ? Number(fat) : undefined,
        protein_percent: protein ? Number(protein) : undefined,
        lab_test_date: testedOn,
      });
      setDone(
        r.over_ceiling
          ? `Filed against ${r.name}. The cell count is above the farm's ceiling — worth a look at the herd.`
          : `Filed against ${r.name}.`,
      );
      setScc("");
      setFat("");
      setProtein("");
      setPicked(null);
      await qc.invalidateQueries({ queryKey: ["quality-options"] });
    } catch (e) {
      setError(extractFrappeError(e));
    } finally {
      setSaving(false);
    }
  };

  if (q.isLoading) return <Loader />;
  if (q.error) return <Banner tone="danger">{extractFrappeError(q.error)}</Banner>;
  if (!data) return null;

  return (
    <View>
      <Banner tone="info">
        {data.mode === "At milking"
          ? "This farm records quality at milking. What is listed here was left blank at the time, or came in from a handset."
          : "This farm records quality afterwards. Every milking arrives here for its figures."}
        {data.required_in_lab
          ? " A recording stays on this list until a figure is entered."
          : " Nothing is chased — the list is for reference."}
      </Banner>

      <View style={s.figures}>
        <Figure label="Awaiting quality" value={String(pending.length)} hint="last 60 days" />
        <Figure label="Filed" value={String(recent.length)} hint="last 60 days" />
        <Figure
          label="Over the ceiling"
          value={String(flagged)}
          hint={data.scc_ceiling ? `above ${fmt(data.scc_ceiling)} × 1000 cells/ml` : "no ceiling set"}
        />
      </View>

      <SectionTitle>Filed results</SectionTitle>
      <Text style={s.hint}>The last sixty days, newest first.</Text>
      {!recent.length ? (
        <Text style={s.empty}>Nothing filed yet.</Text>
      ) : (
        recent.map((r) => (
          <View key={r.name} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{r.herd}</Text>
              <Text style={s.meta}>
                Milked {r.recording_date} · Tested {r.lab_test_date || "—"}
              </Text>
            </View>
            <View style={s.nums}>
              <Text style={[s.num, r.over_ceiling && { color: c.danger, ...font("700") }]}>
                SCC {r.bulk_scc ? fmt(r.bulk_scc) : "—"}
              </Text>
              <Text style={s.meta}>
                Fat {r.fat_percent ? fmt(r.fat_percent) : "—"}% · Protein{" "}
                {r.protein_percent ? fmt(r.protein_percent) : "—"}%
              </Text>
            </View>
          </View>
        ))
      )}

      <SectionTitle>Record</SectionTitle>
      {!pending.length ? (
        <Text style={s.empty}>Nothing outstanding. Every milking in the last sixty days has its figures.</Text>
      ) : (
        <>
          <Text style={s.hint}>Awaiting quality — oldest milking at the bottom.</Text>
          {pending.map((p) => {
            const on = p.name === active?.name;
            return (
              <Pressable
                key={p.name}
                onPress={() => setPicked(p.name)}
                style={[s.row, on && { backgroundColor: c.bgMuted }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{p.herd}</Text>
                  <Text style={s.meta}>
                    {p.recording_date}
                    {p.milking_time ? ` · ${String(p.milking_time).slice(0, 5)}` : ""}
                  </Text>
                </View>
                <Text style={s.meta}>{fmt(p.net_yield_kg)} kg</Text>
              </Pressable>
            );
          })}

          {active ? (
            <View style={s.form}>
              <Text style={s.formTitle}>File a result</Text>
              <Text style={s.hint}>
                {`${active.herd} · ${active.recording_date} · ${fmt(active.net_yield_kg)} kg sellable`}
              </Text>
              <FieldRow>
                <View style={{ flex: 1 }}>
                  <Field label="Bulk tank SCC (× 1000 cells/ml)">
                    <Input
                      value={scc}
                      onChangeText={setScc}
                      keyboardType="decimal-pad"
                      style={overCeiling ? { borderColor: c.danger } : undefined}
                    />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Lab test date">
                    <DateField value={testedOn} onChange={setTestedOn} maximumDate={new Date()} />
                  </Field>
                </View>
              </FieldRow>
              <FieldRow>
                <View style={{ flex: 1 }}>
                  <Field label="Fat %">
                    <Input value={fat} onChangeText={setFat} keyboardType="decimal-pad" />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Protein %">
                    <Input value={protein} onChangeText={setProtein} keyboardType="decimal-pad" />
                  </Field>
                </View>
              </FieldRow>
              {overCeiling ? (
                <Banner tone="danger">
                  {fmt(Number(scc))} is above the farm&apos;s ceiling of {fmt(data.scc_ceiling)}. It will still be
                  filed — the figure is the figure — and flagged on the list above.
                </Banner>
              ) : null}
              <Text style={s.hint}>
                One figure is enough. Saving an empty result is refused, because it would clear the chase without
                answering it.
              </Text>
              {error ? <Banner tone="danger">{error}</Banner> : null}
              {done ? <Banner tone="success">{done}</Banner> : null}
              {mayFile ? (
                <Button label={saving ? "Filing…" : "File the result"} onPress={save} loading={saving} disabled={offline} />
              ) : (
                <Text style={s.hint}>You may read these but not file them.</Text>
              )}
            </View>
          ) : null}
        </>
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
