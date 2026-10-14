import { useQuery } from "@tanstack/react-query";

import { getBatchPlan } from "@/src/frappe/batches";

/** The batches an item holds in a store; `undefined` until answered or on failure. */
export const useBatchPlan = (itemCode: string, warehouse: string) =>
  useQuery({
    queryKey: ["batch-plan", itemCode, warehouse],
    queryFn: () => getBatchPlan(itemCode, warehouse, 0),
    enabled: !!itemCode && !!warehouse,
    staleTime: 30_000,
  }).data ?? undefined;
