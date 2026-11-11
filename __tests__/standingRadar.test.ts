import type { StandingMetric } from "@/src/frappe/standing";
import {
  averageScore,
  axisPoint,
  defaultView,
  normalise,
  polygonPoints,
  radarAxes,
  rankText,
  viewFor,
} from "@/src/standingRadar";

const m = (over: Partial<StandingMetric>): StandingMetric => ({
  key: "k",
  label: "K",
  unit: "",
  better: null,
  value: 10,
  herd: { avg: 10, n: 30, top: null },
  group: { avg: 10, n: 12, top: null },
  ...over,
});

describe("normalise", () => {
  it("a ranked measure is her percentile, best on the rim", () => {
    expect(normalise(m({ better: "lower", group: { avg: 2, n: 12, top: 1 } }))).toBe(100);
    expect(normalise(m({ better: "lower", group: { avg: 2, n: 12, top: 50 } }))).toBe(51);
    expect(normalise(m({ better: "higher", group: { avg: 2, n: 12, top: 100 } }))).toBe(1);
  });
  it("an unranked measure is value ÷ twice the average, capped", () => {
    expect(normalise(m({ value: 400, group: { avg: 400, n: 12, top: null } }))).toBe(50);
    expect(normalise(m({ value: 600, group: { avg: 400, n: 12, top: null } }))).toBe(75);
    expect(normalise(m({ value: 1000, group: { avg: 400, n: 12, top: null } }))).toBe(100);
  });
  it("no figure is null; the herd stands in when the group is only her", () => {
    expect(normalise(m({ value: null }))).toBeNull();
    const solo = m({
      value: 300,
      group: { avg: 300, n: 1, top: null },
      herd: { avg: 600, n: 30, top: null },
    });
    expect(normalise(solo)).toBe(25);
  });
  it("the group average sits on the middle ring", () => {
    expect(averageScore(m({}))).toBe(50);
    expect(
      averageScore(m({ group: { avg: null, n: 12, top: null }, herd: { avg: null, n: 30, top: null } })),
    ).toBeNull();
  });
});

describe("polygon points", () => {
  it("first axis at the top, clockwise", () => {
    expect(axisPoint(0, 4, 100, 100, 50)).toEqual({ x: 100, y: 50 });
    expect(axisPoint(1, 4, 100, 100, 50)).toEqual({ x: 150, y: 100 });
    expect(axisPoint(2, 4, 100, 100, 50)).toEqual({ x: 100, y: 150 });
    expect(axisPoint(3, 4, 100, 100, 50)).toEqual({ x: 50, y: 100 });
  });
  it("scores scale the radius; null sits at the centre", () => {
    expect(polygonPoints([100, 50, null, 0], 100, 100, 80)).toBe("100,20 140,100 100,100 100,100");
  });
});

describe("default view", () => {
  const four = ["parity", "services_per_conception", "calving_interval", "last_weight"].map((key) =>
    m({ key }),
  );
  it("chart with three or more measures with a figure, list with fewer", () => {
    expect(defaultView(four)).toBe("chart");
    expect(defaultView(four.slice(0, 3))).toBe("chart");
    expect(defaultView([m({ key: "last_weight" })])).toBe("list");
    expect(defaultView(four.map((x, i) => (i < 2 ? { ...x, value: null } : x)))).toBe("list");
  });
  it("the user's choice wins either way", () => {
    expect(viewFor(four, "list")).toBe("list");
    expect(viewFor([m({})], "chart")).toBe("chart");
    expect(viewFor(four, null)).toBe("chart");
  });
});

describe("axes", () => {
  it("one per measure, short labels, rank text", () => {
    const axes = radarAxes([
      m({
        key: "calving_interval",
        label: "Calving interval",
        better: "lower",
        group: { avg: 400, n: 12, top: 20 },
      }),
      m({ key: "last_weight", label: "Last weight", unit: "kg" }),
    ]);
    expect(axes.map((a) => a.label)).toEqual(["Calv. interval", "Weight"]);
    expect(rankText(axes[0])).toBe("Top 20%");
    expect(rankText(axes[1])).toMatch(/not ranked/);
  });
});
