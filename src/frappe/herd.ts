import type { Herd } from "@/types";
import { getClient } from "@/src/services/api";

export const HERD_LIST_FIELDS = [
  "name",
  "category",
  "head_count",
  "cost_center",
  "bom",
] as const;

type HerdRow = Record<string, any>;

export const mapHerd = (row: HerdRow): Herd => ({
  n: row.name,
  cat: row.category ?? "",
  cnt: Number(row.head_count ?? 0),
  cc: row.cost_center ?? "",
  bom: row.bom ?? "",
  // ration + kgPerHeadPerDay are not on the Herds DocType yet — spec §13.
  // Mapper returns defaults; UI hides/falls back gracefully.
  ration: [],
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
