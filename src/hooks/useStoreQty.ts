import { useQuery } from "@tanstack/react-query";

import { getItemStoreQty } from "@/src/frappe/stock";

export const storeQtyKey = (itemCode: string, warehouse: string) =>
  `${itemCode}@@${warehouse}`;

export type StoreQtyPair = { itemCode: string; warehouse: string };

/**
 * Live on-hand quantity for each (item, warehouse) pair, so the operator can
 * see what's in the store *while* filling drug / semen / DCT rows. Returns a
 * lookup keyed by `storeQtyKey`. Only pairs with both an item and a warehouse
 * are fetched; the query is disabled when there are none.
 */
export function useStoreQtyMap(pairs: StoreQtyPair[]) {
  const clean = pairs.filter((p) => p.itemCode && p.warehouse);
  const key = clean
    .map((p) => storeQtyKey(p.itemCode, p.warehouse))
    .sort()
    .join("|");

  return useQuery({
    queryKey: ["storeQty", key],
    enabled: clean.length > 0,
    queryFn: async () => {
      const map: Record<string, number> = {};
      for (const p of clean) {
        map[storeQtyKey(p.itemCode, p.warehouse)] = await getItemStoreQty(
          p.itemCode,
          p.warehouse,
        );
      }
      return map;
    },
  });
}
