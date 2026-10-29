import { useQueries } from "@tanstack/react-query";

import { mergeWarnings } from "@/src/beef/kinship";
import { kinshipCheck } from "@/src/frappe/kinship";
import type { Animal } from "@/types";

/**
 * Ask the server, for each animal, whether the destination herd would put him or
 * her with a parent, child or sibling. Runs only when the destination is a
 * Breeding herd and the farm has the check on. The answer is shown before Save.
 */
export function useKinshipPreview(animals: Animal[], herd: string, enabled: boolean) {
  const results = useQueries({
    queries: animals.map((a) => ({
      queryKey: ["kinship", a.id, herd],
      queryFn: () => kinshipCheck(a.id, herd),
      enabled: enabled && !!herd,
      staleTime: 30_000,
    })),
  });
  const loading = results.some((r) => r.isFetching);
  const warnings = mergeWarnings(
    ...results.map((r, i) => (r.data?.warnings ?? []).map((w) => (animals.length > 1 ? `${animals[i].name}: ${w}` : w))),
  );
  return { warnings, loading };
}
