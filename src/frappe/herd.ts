import type { Herd } from "@/types";
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

export const mapHerd = (row: HerdRow): Herd => ({
  n: row.name,
  herdName: row.herd_name || row.name,
  cat: row.custom_herd_category ?? "",
  cnt: Number(row.number_of_animals ?? 0),
  cc: row.cost_center ?? row.custom_cost_center ?? "",
  bom: row.bom ?? "",
  isMilking: !!row.custom_is_milking,
  isDry: !!row.custom_is_dry,
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
