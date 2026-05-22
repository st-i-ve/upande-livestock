import type { Herd, RationItem } from "@/types";
import { getClient } from "@/src/services/api";

// Field names verified against the live `Herds` DocType on
// upande-kaitet2.c.frappe.cloud (see get_doctype_info("Herds")).
// `custom_herd_category` values: Milking, Dry, Youngstock > 12m, Youngstock < 12m.
export const HERD_LIST_FIELDS = [
  "name",
  "herd_name",
  "custom_herd_category",
  "number_of_animals",
  "cost_center",
  "custom_cost_center",
  "bom",
  "custom_is_milking",
  "custom_is_dry",
  "custom_is_calf_rearing",
] as const;

type HerdRow = Record<string, any>;

const mapRationItem = (row: any): RationItem => ({
  name: row?.item_code || row?.item_name || row?.name || "",
  // The Feeding Ration Item child rows likely use `qty` or `ratio`. We accept
  // either; fall back to 0 so the UI just shows the line without a percentage.
  pct: Number(row?.ratio ?? row?.percent ?? row?.qty ?? 0),
});

export const mapHerd = (row: HerdRow): Herd => ({
  n: row.name,
  cat: row.custom_herd_category ?? "",
  cnt: Number(row.number_of_animals ?? 0),
  cc: row.cost_center ?? row.custom_cost_center ?? "",
  bom: row.bom ?? "",
  ration: Array.isArray(row.ration_items)
    ? row.ration_items.map(mapRationItem)
    : [],
  // `kg_per_head_per_day` is not a field on the Herds DocType. The per-head
  // daily ration size comes from the linked BOM (see `bom`), which we don't
  // resolve in this sub-project. UI shows "—" when this is 0.
  kgPerHeadPerDay: 0,
});

export const getHerds = async (): Promise<Herd[]> => {
  const client = await getClient();
  const res = await client.get("/api/resource/Herds", {
    params: {
      fields: JSON.stringify(HERD_LIST_FIELDS),
      limit_page_length: 500,
      order_by: "name asc",
    },
  });
  const rows = (res.data?.data ?? []) as any[];
  return rows.map(mapHerd);
};

/**
 * Fetch a single herd with its `ration_items` child table populated.
 * `/api/resource/Herds/<name>` returns child tables inline.
 */
export const getHerd = async (name: string): Promise<Herd | null> => {
  const client = await getClient();
  try {
    const res = await client.get(
      `/api/resource/Herds/${encodeURIComponent(name)}`,
    );
    const row = res.data?.data;
    if (!row) return null;
    return mapHerd(row);
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
};
