import { appetiteLabel, changedKg, dayIsOpen, parseKg, signedKg } from "@/src/feed/daySheet";
import { amendFeedDay, resetFeedDay, getDailyFeedReport, getFeedDayProgram, manufactureFeedActuals } from "@/src/frappe/feedActuals";

const mockPost = jest.fn();
jest.mock("@/src/services/api", () => ({ getClient: async () => ({ post: mockPost }) }));

const day = {
  herd: "H1", herd_name: "Finishers", date: "2026-11-18", head_count: 10, status: "Planned", amended: false,
  planned_kg: 100, actual_kg: 100, planned_per_head: 10, actual_per_head: 10, variance_kg: 0,
  components: [
    { item_code: "HAY", item_name: "Hay", uom: "kg", planned_kg: 60, actual_kg: 60 },
    { item_code: "MAIZE", item_name: "Maize", uom: "kg", planned_kg: 40, actual_kg: 40 },
  ],
  stock: { work_order: "WO-1" },
};

beforeEach(() => mockPost.mockReset());

describe("day sheet maths", () => {
  it("parses kg boxes strictly", () => {
    expect(parseKg("12.5")).toBe(12.5);
    expect(parseKg("12,5")).toBe(12.5);
    expect(parseKg("0")).toBe(0);
    expect(parseKg("")).toBeNull();
    expect(parseKg("-3")).toBeNull();
    expect(parseKg("abc")).toBeNull();
  });
  it("sends only what changed and flags unusable boxes", () => {
    const comps = getComps();
    expect(changedKg(comps, { HAY: "60", MAIZE: "35" })).toEqual({ changes: { MAIZE: 35 }, invalid: [] });
    expect(changedKg(comps, { HAY: "x" })).toEqual({ changes: {}, invalid: ["Hay"] });
  });
  it("labels", () => {
    expect(signedKg(5)).toBe("+5 kg");
    expect(appetiteLabel("below")).toBe("Below plan");
    expect(appetiteLabel("on_plan")).toBe("On plan");
    expect(dayIsOpen({ status: "Amended" })).toBe(true);
    expect(dayIsOpen({ status: "Waiting for stock" })).toBe(false);
  });
});

function getComps() {
  mockPost.mockResolvedValueOnce({ data: { message: { date: "d", herds: [day] } } });
  return [
    { itemCode: "HAY", itemName: "Hay", uom: "kg", plannedKg: 60, actualKg: 60, plannedPerHead: 6, actualPerHead: 6, removed: false },
    { itemCode: "MAIZE", itemName: "Maize", uom: "kg", plannedKg: 40, actualKg: 40, plannedPerHead: 4, actualPerHead: 4, removed: false },
  ];
}

describe("feed actuals API", () => {
  it("maps the program", async () => {
    mockPost.mockResolvedValueOnce({ data: { message: { date: "2026-11-18", herds: [day], skipped: [], setup: [] } } });
    const p = await getFeedDayProgram("2026-11-18");
    expect(mockPost.mock.calls[0][0]).toBe("/api/method/upande_livestock.serverscripts.feeding.feed_actuals.feed_day_program");
    expect(p.herds[0]).toMatchObject({ herdName: "Finishers", headCount: 10, workOrder: "WO-1" });
    expect(p.herds[0].components[1]).toMatchObject({ itemCode: "MAIZE", plannedKg: 40 });
  });
  it("amend posts the changed components as JSON", async () => {
    mockPost.mockResolvedValueOnce({ data: { message: { ...day, amended: true } } });
    const d = await amendFeedDay("H1", "2026-11-18", { MAIZE: 35 }, "ate less");
    const body = mockPost.mock.calls[0][1];
    expect(JSON.parse(body.components)).toEqual([{ item_code: "MAIZE", actual_kg: 35 }]);
    expect(body.remarks).toBe("ate less");
    expect(d.amended).toBe(true);
  });
  it("throws the server's refusal instead of returning it", async () => {
    mockPost.mockResolvedValueOnce({ data: { message: { error: "Cancel that feeding first." } } });
    await expect(amendFeedDay("H1", "2026-11-18", { MAIZE: 1 })).rejects.toThrow("Cancel that feeding first.");
  });
  it("manufacture reports what stock waits for", async () => {
    mockPost.mockResolvedValueOnce({ data: { message: { ...day, status: "Waiting for stock", waiting_for: [{ item_name: "Hay" }] } } });
    const d = await manufactureFeedActuals("H1", "2026-11-18", "EMP-1");
    expect(d.status).toBe("Waiting for stock");
    expect(d.waitingFor).toEqual(["Hay"]);
  });
  it("accepts waiting_for as a sentence string", async () => {
    mockPost.mockResolvedValueOnce({ data: { message: { ...day, status: "Waiting for stock", waiting_for: "Short of Hay by 5 kg" } } });
    const d = await manufactureFeedActuals("H1", "2026-11-18");
    expect(d.waitingFor).toEqual(["Short of Hay by 5 kg"]);
  });
  it("amend can remove an item with 0 and marks it removed", async () => {
    mockPost.mockResolvedValueOnce({ data: { message: { ...day, components: [{ ...day.components[0], actual_kg: 0, removed: true }] } } });
    const d = await amendFeedDay("H1", "2026-11-18", { HAY: 0 });
    expect(JSON.parse(mockPost.mock.calls[0][1].components)).toEqual([{ item_code: "HAY", actual_kg: 0 }]);
    expect(d.components[0].removed).toBe(true);
  });
  it("reset posts herd and date", async () => {
    mockPost.mockResolvedValueOnce({ data: { message: { ...day, record: null } } });
    await resetFeedDay("H1", "2026-11-18");
    expect(mockPost.mock.calls[0][0]).toMatch(/feed_actuals\.reset_feed_day$/);
    expect(mockPost.mock.calls[0][1]).toEqual({ herd: "H1", date: "2026-11-18" });
  });
  it("maps the report with below/above/on plan and null gains", async () => {
    mockPost.mockResolvedValueOnce({
      data: { message: {
        herds: [day], totals: { planned_kg: 100, actual_kg: 80, below_plan: 1, above_plan: 2, on_plan: 3 },
        animals: [{ animal: "A1", tag: "T1", herd: "H1", planned_kg: 10, actual_kg: 8, variance_kg: -2, variance_pct: -20, appetite: "below", last_weight: null, adg: null }],
      } },
    });
    const r = await getDailyFeedReport("2026-11-18");
    expect(r.animals[0]).toMatchObject({ appetite: "below", lastWeight: null, adg: null });
    expect(r.totals).toEqual({ plannedKg: 100, actualKg: 80, belowPlan: 1, abovePlan: 2, onPlan: 3 });
  });
});
