import {
  changeUnit,
  groupTotal,
  kgEquivalent,
  linesToSend,
  manualLine,
  perHeadLabel,
  unitOptions,
  withKgPer,
} from "@/src/feed/manualLines";
import { editLine, unheld } from "@/src/feed/rationMaths";
import type { UnitsMap } from "@/src/feed/units";
import { getFeedDayStatus, manufactureHerdFeed } from "@/src/frappe/feeding";
import { getHerdRecipes } from "@/src/frappe/herdRecipes";
import { manualFeed } from "@/src/frappe/manualFeed";

const mockPost = jest.fn();
jest.mock("@/src/services/api", () => ({ getClient: async () => ({ post: mockPost }) }));

// Molasses is stocked in Litre at 1.4 kg a litre; hay in BALE with a kilogram row.
const UNITS: UnitsMap = {
  MOL: { stock_uom: "Litre", uoms: [{ uom: "Litre", factor: 1, kg: 1.4 }, { uom: "Kg", factor: 0.714, kg: 1 }] },
  HAY: { stock_uom: "BALE", uoms: [{ uom: "BALE", factor: 1, kg: 14.29 }, { uom: "Kilogram", factor: 0.07, kg: 1 }] },
};

beforeEach(() => mockPost.mockReset());

describe("manual feeding lines", () => {
  it("doses are g/head and ml/head, sent back in Gram and Millilitre", () => {
    const yeast = manualLine({ itemCode: "DIAMOND", itemName: "Diamond V", qty: 7, uom: "Gram", isDose: true });
    const grow = manualLine({ itemCode: "GROW", itemName: "Meat Grow", qty: 60, uom: "Millilitre" });
    expect(perHeadLabel(yeast)).toBe("g/head");
    expect(perHeadLabel(grow)).toBe("ml/head");
    expect(linesToSend([yeast, grow])).toEqual([
      { itemCode: "DIAMOND", qty: 7, uom: "Gram" },
      { itemCode: "GROW", qty: 60, uom: "Millilitre" },
    ]);
    expect(unitOptions(UNITS, yeast)).toEqual(["Gram"]);
  });

  it("every line carries its own unit; Kg and Kilogram are both kilos", () => {
    const rows = [
      manualLine({ itemCode: "SIL", itemName: "Silage", qty: 10, uom: "Kg" }),
      manualLine({ itemCode: "HAY", itemName: "Hay", qty: 2, uom: "Kilogram" }),
    ];
    expect(rows.map((r) => r.unit)).toEqual(["kg", "kg"]);
    expect(rows.map(perHeadLabel)).toEqual(["kg/head", "kg/head"]);
    expect(linesToSend(rows)).toEqual([
      { itemCode: "SIL", qty: 10, uom: "Kg" },
      { itemCode: "HAY", qty: 2, uom: "Kilogram" },
    ]);
  });

  it("offers kilos under the item's own name, then its store units", () => {
    expect(unitOptions(UNITS, { itemCode: "MOL", uom: "Kg" })).toEqual(["Kg", "Litre"]);
    expect(unitOptions(UNITS, { itemCode: "HAY", uom: "Kilogram" })).toEqual(["Kilogram", "BALE"]);
  });

  it("a line put in litres keeps its kilos and shows them", () => {
    const kg = manualLine({ itemCode: "MOL", itemName: "Molasses", qty: 4.2, uom: "Kg" });
    const litres = changeUnit(UNITS, kg, "Litre");
    expect(litres.qty).toBe("3");
    expect(litres.uom).toBe("Litre");
    expect(kgEquivalent(withKgPer([litres], UNITS)[0])).toBe("3 Litre ≈ 4.20 kg");
    expect(linesToSend([litres])).toEqual([{ itemCode: "MOL", qty: 3, uom: "Litre" }]);
    expect(changeUnit(UNITS, litres, "Kg").qty).toBe("4.2");
  });

  it("shares count a litre line at its kilos, and a typed % locks against the sum", () => {
    const rows = withKgPer(
      [
        manualLine({ itemCode: "SIL", itemName: "Silage", qty: 9.8, uom: "Kg" }),
        manualLine({ itemCode: "MOL", itemName: "Molasses", qty: 3, uom: "Litre" }),
        manualLine({ itemCode: "DIAMOND", itemName: "Diamond V", qty: 7, uom: "Gram" }),
      ],
      UNITS,
    );
    expect(unheld(rows).map((r) => r.pct)).toEqual(["70", "30", ""]);
    const r = editLine(unheld(rows), "", 1, "pct", "20");
    expect(r.total).toBe("14");
    expect(r.rows[1].locked).toBe(true);
    expect(r.rows[1].qty).toBe("2"); // 2.8 kg is 2 litres
    expect(r.rows[0].qty).toBe("11.2");
    expect(r.rows[2].qty).toBe("7"); // the dose is not moved
  });

  it("the group total: head count x per head as a suggestion, what is typed is sent", () => {
    expect(groupTotal(true, null, 14, 40, 0.5)).toEqual({ suggestion: 280, shown: "", send: undefined, error: null });
    const seeded = groupTotal(false, null, 14, 40, 0.5);
    expect(seeded.shown).toBe("280");
    expect(seeded.send).toBe(280);
    expect(groupTotal(false, "265.5", 14, 40, 0.5).send).toBe(265.5);
    expect(groupTotal(false, "", 14, 40).error).toMatch(/kilos this group/);
  });
});

describe("sent to the server", () => {
  it("manual feed sends each line's unit and the typed total", async () => {
    mockPost.mockResolvedValue({ data: { message: { work_order: "WO-1" } } });
    await manualFeed({
      herd: "FINISHERS",
      heads: 40,
      lines: [
        { itemCode: "SIL", qty: 10, uom: "Kg" },
        { itemCode: "DIAMOND", qty: 7, uom: "Gram" },
        { itemCode: "MOL", qty: 3, uom: "Litre" },
      ],
      totalQty: 265.5,
    });
    const payload = mockPost.mock.calls[0][1].payload;
    expect(payload.action).toBe("manual");
    expect(payload.total_qty).toBe(265.5);
    expect(payload.lines).toEqual([
      { item_code: "SIL", qty: 10, uom: "Kg" },
      { item_code: "DIAMOND", qty: 7, uom: "Gram" },
      { item_code: "MOL", qty: 3, uom: "Litre" },
    ]);
  });

  it("manufacture sends the typed total as total_qty", async () => {
    mockPost.mockResolvedValue({ data: { message: { work_order: "WO-2" } } });
    await manufactureHerdFeed("FINISHERS", 0.5, undefined, undefined, 280);
    expect(mockPost.mock.calls[0][1].payload).toMatchObject({ action: "manufacture", portion: 0.5, total_qty: 280 });
  });

  it("feed day status reads feed_by_head_count, on unless the server says off", async () => {
    mockPost.mockResolvedValueOnce({ data: { message: { herd: "H", per_head_kg: 14, feed_by_head_count: false } } });
    expect((await getFeedDayStatus("H")).feedByHeadCount).toBe(false);
    mockPost.mockResolvedValueOnce({ data: { message: { herd: "H" } } });
    expect((await getFeedDayStatus("H")).feedByHeadCount).toBe(true);
  });

  it("herd recipes mark per-head doses", async () => {
    mockPost.mockResolvedValue({
      data: {
        message: {
          herd: "H",
          standing_bom: "B1",
          recipes: [{ bom_no: "B1", lines: [
            { item_code: "DIAMOND", item_name: "Diamond V", qty: 7, uom: "Gram", is_dose: true },
            { item_code: "SIL", item_name: "Silage", qty: 10, uom: "Kg", is_dose: false },
          ] }],
        },
      },
    });
    const r = await getHerdRecipes("H");
    expect(r.recipes[0].lines.map((l) => l.isDose)).toEqual([true, false]);
  });
});
