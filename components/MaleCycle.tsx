import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { font } from "@/constants/theme";
import { GROWTH_ORDER, STAGE_LABELS, STAGE_NOTES } from "@/services/utils";
import type { CycleState } from "@/src/frappe/animal";
import { useColors } from "@/src/hooks/useColors";

/**
 * A male's cycle, as on the desk: a steer or young bull on feed climbs a liveweight
 * ladder (calf, weaner, grower, finisher, market-ready); a bull kept for breeding
 * shows whether he is at rest or in the breeding cycle. Not the calving loop.
 */
export function MaleCycle({ cycle, stage, cached }: { cycle: CycleState; stage: string; cached?: boolean }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  if (cycle.kind === "bull" || stage === "bull") {
    const b = cycle.bull;
    return (
      <View style={s.box} testID="bull-status">
        <Text style={s.label}>Breeding</Text>
        <View style={s.row}>
          <Text style={s.title}>{cycle.class ?? "Breeding bull"}</Text>
          {b ? (
            <View style={[s.badge, { backgroundColor: b.state === "In breeding cycle" ? c.text : c.textSubtle }]}>
              <Text style={[s.badgeText, { color: c.bg }]}>{b.state}</Text>
            </View>
          ) : null}
        </View>
        {b ? (
          <Text style={s.meta}>
            {b.reason}
            {b.lastService ? ` · last service ${b.lastService}` : ""}
          </Text>
        ) : null}
        {cached ? <Text style={s.meta}>Last saved answer (offline)</Text> : null}
      </View>
    );
  }

  const g = cycle.growth;
  const at = GROWTH_ORDER.indexOf(stage as (typeof GROWTH_ORDER)[number]);
  return (
    <View style={s.box} testID="growth-ladder">
      <Text style={s.label}>Growth</Text>
      <View style={s.row}>
        <Text style={s.title}>{STAGE_LABELS[stage] ?? stage}</Text>
        <Text style={s.meta}>{g ? `${g.kg} kg now` : (STAGE_NOTES[stage] ?? "")}</Text>
      </View>
      {g && g.nextKg != null ? (
        <View style={{ gap: 4 }}>
          <View style={s.row}>
            <Text style={s.meta}>{Math.round(g.fromKg)} kg</Text>
            <Text style={s.meta}>
              {g.pct}% to {(STAGE_LABELS[g.nextStage ?? "market"] ?? "").toLowerCase()} at {Math.round(g.nextKg)} kg
            </Text>
          </View>
          <View style={s.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: g.pct }}>
            <View style={[s.fill, { width: `${g.pct}%` }]} />
          </View>
        </View>
      ) : null}
      <View style={s.steps}>
        {GROWTH_ORDER.map((k, i) => (
          <Text
            key={k}
            style={[s.step, k === stage && s.stepNow, at >= 0 && i < at && { opacity: 0.6 }]}
          >
            {STAGE_LABELS[k]}
          </Text>
        ))}
      </View>
      {g ? (
        <View style={s.stats}>
          <Stat label="Daily gain" value={g.adg == null ? "—" : `${g.adg.toFixed(2)} kg/d`} />
          <Stat label="Days to next" value={g.daysToNext == null ? "—" : String(g.daysToNext)} />
          <Stat label="Days on feed" value={g.daysOnFeed == null ? "—" : String(g.daysOnFeed)} />
        </View>
      ) : cycle.nextUp ? (
        <Text style={s.meta}>{cycle.nextUp}</Text>
      ) : null}
      {cached ? <Text style={s.meta}>Last saved answer (offline)</Text> : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 9, ...font("500"), letterSpacing: 1, textTransform: "uppercase", color: c.textSubtle }}>
        {label}
      </Text>
      <Text style={{ fontSize: 14, ...font("600"), color: c.text }}>{value}</Text>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    box: { padding: 14, marginBottom: 12, borderRadius: 14, borderWidth: 1, borderColor: c.border, gap: 10 },
    label: { fontSize: 10, ...font("500"), letterSpacing: 1, textTransform: "uppercase", color: c.textSubtle },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
    title: { fontSize: 20, ...font("700"), color: c.text },
    meta: { fontSize: 12, color: c.textMuted },
    badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
    badgeText: { fontSize: 12, ...font("600") },
    track: { height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: c.bgMuted },
    fill: { height: "100%", borderRadius: 5, backgroundColor: c.text },
    steps: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    step: { fontSize: 12, color: c.textSubtle, paddingHorizontal: 8, paddingVertical: 2 },
    stepNow: { color: c.text, ...font("700"), backgroundColor: c.bgMuted, borderRadius: 999, overflow: "hidden" },
    stats: { flexDirection: "row", gap: 12 },
  });
