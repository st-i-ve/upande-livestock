import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line, Polygon, Rect, Text as SvgText } from "react-native-svg";

import { font } from "@/constants/theme";
import type { StandingMetric } from "@/src/frappe/standing";
import { useColors } from "@/src/hooks/useColors";
import {
  axisPoint,
  fmtValue,
  polygonPoints,
  radarAxes,
  rankText,
  type StandingView,
} from "@/src/standingRadar";

/** Drawing space; the SVG scales it to the card's width. */
const W = 320;
const H = 270;
const CX = W / 2;
const CY = H / 2 + 2;
const R = 78;
const RINGS = [25, 50, 75, 100];
const LABEL_GAP = 10;

/**
 * Her measures on one shape, outward is better (see src/standingRadar). Her
 * polygon in the accent colour, the group average dashed, rings at 25/50/75/100.
 * Tap an axis label for that measure's value, group and herd average, and rank.
 */
export function StandingRadar({ metrics, groupLabel }: { metrics: StandingMetric[]; groupLabel: string }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const axes = useMemo(() => radarAxes(metrics), [metrics]);
  const [picked, setPicked] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const n = axes.length;
  if (n === 0) return null;

  const accent = c.selected;
  const known = axes.some((a) => a.score != null);
  const hasAvg = axes.some((a) => a.avgScore != null);
  const sel = axes.find((a) => a.key === picked) ?? null;

  return (
    <View style={s.wrap} onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}>
      {width > 0 ? (
        <Svg
          width={width}
          height={(width * H) / W}
          viewBox={`0 0 ${W} ${H}`}
          accessibilityLabel="Performance radar"
        >
          {RINGS.map((ring) => (
            <Polygon
              key={ring}
              points={polygonPoints(
                axes.map(() => ring),
                CX,
                CY,
                R,
              )}
              fill="none"
              stroke={c.border}
              strokeWidth={ring === 100 ? 1 : 0.75}
            />
          ))}
          {axes.map((a, i) => {
            const p = axisPoint(i, n, CX, CY, R);
            return (
              <Line key={a.key} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke={c.border} strokeWidth={0.75} />
            );
          })}
          {hasAvg ? (
            <Polygon
              points={polygonPoints(
                axes.map((a) => a.avgScore),
                CX,
                CY,
                R,
              )}
              fill="none"
              stroke={c.textMuted}
              strokeWidth={1.25}
              strokeDasharray="4 3"
            />
          ) : null}
          {known ? (
            <Polygon
              points={polygonPoints(
                axes.map((a) => a.score),
                CX,
                CY,
                R,
              )}
              fill={accent}
              fillOpacity={0.18}
              stroke={accent}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          ) : null}
          {axes.map((a, i) => {
            if (a.score == null) return null;
            const p = axisPoint(i, n, CX, CY, (R * a.score) / 100);
            return <Circle key={a.key} cx={p.x} cy={p.y} r={a.key === picked ? 4.5 : 3} fill={accent} />;
          })}
          {axes.map((a, i) => {
            const p = axisPoint(i, n, CX, CY, R + LABEL_GAP);
            const anchor = p.x > CX + 4 ? "start" : p.x < CX - 4 ? "end" : "middle";
            // Top label sits above the point, bottom label below, sides centred on it.
            const y0 = p.y < CY - 4 ? p.y - 16 : p.y > CY + 4 ? p.y + 6 : p.y - 6;
            const on = a.key === picked;
            const boxW = 92;
            const boxX = anchor === "start" ? p.x - 4 : anchor === "end" ? p.x - boxW + 4 : p.x - boxW / 2;
            return (
              <G key={a.key} onPress={() => setPicked(on ? null : a.key)}>
                <Rect x={boxX} y={y0 - 4} width={boxW} height={34} fill="transparent" />
                <SvgText
                  x={p.x}
                  y={y0 + 8}
                  textAnchor={anchor}
                  fontSize={11}
                  fontFamily="Poppins_500Medium"
                  fill={on ? accent : c.textMuted}
                >
                  {a.label}
                </SvgText>
                <SvgText
                  x={p.x}
                  y={y0 + 22}
                  textAnchor={anchor}
                  fontSize={12}
                  fontFamily="Poppins_600SemiBold"
                  fill={on ? accent : c.text}
                >
                  {fmtValue(a.metric.value, a.metric.unit)}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      ) : null}

      <View style={s.legend}>
        <View style={[s.key, { backgroundColor: accent }]} />
        <Text style={s.legendText}>This animal</Text>
        <View style={[s.keyDash, { borderColor: c.textMuted }]} />
        <Text style={s.legendText}>Average of {groupLabel}</Text>
      </View>

      {sel ? (
        <View style={s.detail}>
          <Text style={s.detailTitle}>{sel.metric.label}</Text>
          <Row label="This animal" value={fmtValue(sel.metric.value, sel.metric.unit)} s={s} />
          <Row
            label={`Average of ${groupLabel}`}
            value={fmtValue(sel.metric.group.avg, sel.metric.unit)}
            s={s}
          />
          <Row label="Herd average" value={fmtValue(sel.metric.herd.avg, sel.metric.unit)} s={s} />
          <Row label="Rank" value={rankText(sel)} s={s} />
        </View>
      ) : (
        <Text style={s.hint}>
          Tap a measure for its detail. Outward is better; the dashed line is the average.
        </Text>
      )}
    </View>
  );
}

function Row({ label, value, s }: { label: string; value: string; s: ReturnType<typeof makeStyles> }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

/** The small "Chart | List" switch in the section header. */
export function StandingViewToggle({
  value,
  onChange,
}: {
  value: StandingView;
  onChange: (v: StandingView) => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={s.seg} accessibilityRole="tablist">
      {(["chart", "list"] as const).map((v) => {
        const on = v === value;
        return (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            hitSlop={6}
            style={[s.segBtn, on && s.segOn]}
          >
            <Text style={[s.segText, on && s.segTextOn]}>{v === "chart" ? "Chart" : "List"}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    wrap: { gap: 8 },
    legend: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
    },
    key: { width: 12, height: 3, borderRadius: 2 },
    keyDash: {
      width: 14,
      height: 0,
      borderTopWidth: 1.5,
      borderStyle: "dashed",
      marginLeft: 8,
    },
    legendText: { fontSize: 12, color: c.textMuted },
    hint: { fontSize: 12, color: c.textSubtle },
    detail: {
      borderRadius: 10,
      backgroundColor: c.bgMuted,
      padding: 10,
      gap: 4,
    },
    detailTitle: {
      fontSize: 14,
      color: c.text,
      ...font("600"),
      marginBottom: 2,
    },
    row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    rowLabel: { fontSize: 13, color: c.textMuted, flexShrink: 1 },
    rowValue: { fontSize: 13, color: c.text, ...font("600") },
    seg: {
      flexDirection: "row",
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      overflow: "hidden",
    },
    segBtn: { paddingHorizontal: 10, paddingVertical: 3 },
    segOn: { backgroundColor: c.primary },
    segText: { fontSize: 12, color: c.textMuted, ...font("500") },
    segTextOn: { color: c.bg },
  });
