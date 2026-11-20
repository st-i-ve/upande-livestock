import type { Peers, StandingMetric } from "@/src/frappe/standing";

/**
 * The "Performance vs other animals" figures on one shape.
 *
 * As on the web's KpiRadar, EVERY AXIS RUNS THE SAME WAY: outward is better.
 * Each axis is 0–100:
 *  - a ranked measure (one with a better end) is her percentile in the group:
 *    101 − top, so the best of the group sits on the rim and "Top 50%" on the
 *    middle ring. A lower-is-better measure is already ranked that way by the
 *    server, so it needs no inverting here.
 *  - an unranked measure (parity, weight) is her figure against the group
 *    average, value ÷ (2 × average): the average on the middle ring, twice it
 *    on the rim. The same scale as the bars in the list.
 * The group average is therefore the 50 ring on every axis, drawn dashed.
 * A measure she has no figure for sits at the centre rather than being skipped,
 * so the shape never gains a straight edge that reads as a score.
 */

export type StandingView = "chart" | "list";

export type RadarAxis = {
  key: string;
  label: string;
  /** 0–100, outward is better; null when she has no figure. */
  score: number | null;
  /** Where the group's average sits on this axis (0–100). */
  avgScore: number | null;
  metric: StandingMetric;
  /** The peers she is compared with: her group, or the herd if the group is only her. */
  peers: Peers;
};

/** Shorter labels for the chart, where space is tight. */
const SHORT: Record<string, string> = {
  parity: "Parity",
  services_per_conception: "Serv./conc.",
  calving_interval: "Calv. interval",
  last_weight: "Weight",
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** The group she is compared with: her group, or the herd when the group is only her. */
export const peersOf = (m: StandingMetric): Peers => (m.group.n > 1 ? m.group : m.herd);

/** 0–100, outward is better. */
export function normalise(m: StandingMetric, p: Peers = peersOf(m)): number | null {
  if (m.value == null) return null;
  if (p.top != null) return clamp(101 - p.top);
  if (p.avg) return clamp((m.value / (p.avg * 2)) * 100);
  return 50;
}

/** The group's average on the same 0–100 scale (the middle, by construction). */
export function averageScore(m: StandingMetric, p: Peers = peersOf(m)): number | null {
  return p.avg == null ? null : 50;
}

export function radarAxes(metrics: StandingMetric[]): RadarAxis[] {
  return metrics.map((m) => {
    const p = peersOf(m);
    return {
      key: m.key,
      label: SHORT[m.key] ?? m.label,
      score: normalise(m, p),
      avgScore: averageScore(m, p),
      metric: m,
      peers: p,
    };
  });
}

/** Radar when she has three or more measures with a figure; fewer read better as bars. */
export function defaultView(metrics: StandingMetric[]): StandingView {
  return metrics.filter((m) => m.value != null).length >= 3 ? "chart" : "list";
}

/** The user's remembered choice wins; otherwise the rule above. */
export function viewFor(metrics: StandingMetric[], chosen: StandingView | null): StandingView {
  return chosen ?? defaultView(metrics);
}

export type Pt = { x: number; y: number };

/** Axis i of n, starting at the top and going clockwise, at `radius`. */
export function axisPoint(i: number, n: number, cx: number, cy: number, radius: number): Pt {
  const a = (i / n) * 2 * Math.PI - Math.PI / 2;
  const r = (v: number) => Math.round(v * 100) / 100;
  return { x: r(cx + radius * Math.cos(a)), y: r(cy + radius * Math.sin(a)) };
}

/** Polygon for 0–100 scores (null at the centre), as an SVG `points` string. */
export function polygonPoints(scores: (number | null)[], cx: number, cy: number, R: number): string {
  return scores
    .map((s, i) => {
      const p = axisPoint(i, scores.length, cx, cy, (R * clamp(s ?? 0)) / 100);
      return `${p.x},${p.y}`;
    })
    .join(" ");
}

const fmtNum = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));
export const fmtValue = (n: number | null, unit: string) =>
  n == null ? "—" : `${fmtNum(n)}${unit ? ` ${unit}` : ""}`;

/** "Top 20%", or "not ranked" for a measure with no better end. */
export function rankText(a: RadarAxis): string {
  if (a.metric.value == null) return "no record yet";
  if (a.peers.top == null) return "not ranked (no better end)";
  return a.peers.top <= 50 ? `Top ${a.peers.top}%` : `Bottom ${101 - a.peers.top}%`;
}
