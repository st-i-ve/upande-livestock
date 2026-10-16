import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Banner } from "@/components/Banner";
import { Loader } from "@/components/Loader";
import { SectionTitle } from "@/components/SectionTitle";
import type { Peers, StandingMetric } from "@/src/frappe/standing";
import { useAnimalStanding } from "@/src/hooks/useAnimal";
import { useColors } from "@/src/hooks/useColors";

const fmt = (n: number | null, unit: string) =>
  n == null ? "—" : `${Number.isInteger(n) ? n : n.toFixed(1)}${unit ? ` ${unit}` : ""}`;

/** "Top 20%" for a ranked measure, "avg 140 d" for one with no better end. */
const verdict = (m: StandingMetric, p: Peers) =>
  m.value == null
    ? "no record yet"
    : p.top != null
      ? p.top <= 50
        ? `Top ${p.top}%`
        : "Lower half"
      : p.avg != null
        ? `avg ${fmt(p.avg, m.unit)}`
        : "";

/**
 * Her figures against her herd and her group. A bar per measure: the track is
 * the herd's range, the filled part is where she sits in it (for a measure with
 * a better end, full is the good end), the tick is the middle. Online; the last
 * answer is kept and shown with its date when there is no signal.
 */
export function StandingSection({ id }: { id: string }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const q = useAnimalStanding(id);
  const d = q.data;

  return (
    <>
      <SectionTitle>Performance vs other animals</SectionTitle>
      {q.isLoading ? (
        <Loader />
      ) : !d ? (
        <Banner tone="info" icon="wifi-off">
          Needs a connection to compare with the herd.
        </Banner>
      ) : (
        <View style={s.card}>
          {d.cached ? (
            <Banner tone="info" icon="wifi-off">
              Offline: showing the figures from {d.asOf}.
            </Banner>
          ) : null}
          <Text style={s.scope}>
            vs {d.herd.name} ({d.herd.n}) and {d.group.label} ({d.group.n})
          </Text>
          {d.metrics.map((m) => (
            <MetricBar key={m.key} m={m} />
          ))}
          {!d.per_animal_milk ? (
            <Text style={s.note}>Milk per animal is not recorded, so yield is not compared.</Text>
          ) : null}
        </View>
      )}
    </>
  );
}

function MetricBar({ m }: { m: StandingMetric }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  // One bar against the group (herd when the group has nobody to compare).
  const p = m.group.n > 1 ? m.group : m.herd;
  const frac = (() => {
    if (m.value == null) return 0;
    if (p.top != null) return Math.max(0.04, 1 - (p.top - 1) / 100);
    if (p.avg) return Math.max(0.04, Math.min(1, m.value / (p.avg * 2)));
    return 0.5;
  })();
  return (
    <View style={s.item}>
      <View style={s.line}>
        <Text style={s.label}>{m.label}</Text>
        <Text style={s.value}>{fmt(m.value, m.unit)}</Text>
      </View>
      <View style={s.track}>
        <View style={[s.fill, { width: `${Math.round(frac * 100)}%` }]} />
        {m.value != null && p.avg != null ? <View style={[s.tick, { left: "50%" }]} /> : null}
      </View>
      <View style={s.line}>
        <Text style={s.sub}>{verdict(m, p)}</Text>
        <Text style={s.sub}>
          herd {fmt(m.herd.avg, m.unit)} · group {fmt(m.group.avg, m.unit)}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    card: { borderWidth: 1, borderColor: c.borderSubtle, borderRadius: 12, padding: 12, gap: 12 },
    scope: { fontSize: 12, color: c.textMuted },
    item: { gap: 4 },
    line: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    label: { fontSize: 14, color: c.text, fontWeight: "500" },
    value: { fontSize: 14, color: c.text, fontWeight: "600" },
    sub: { fontSize: 12, color: c.textSubtle },
    track: { height: 8, borderRadius: 4, backgroundColor: c.bgMuted, overflow: "hidden" },
    fill: { height: 8, borderRadius: 4, backgroundColor: c.primary },
    tick: { position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: c.bg },
    note: { fontSize: 12, color: c.textSubtle, fontStyle: "italic" },
  });
