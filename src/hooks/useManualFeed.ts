import { useMutation, useQueryClient } from "@tanstack/react-query";

import { manualFeed, type ManualFeedInput } from "@/src/frappe/manualFeed";

// Same reasoning as useManufactureHerdFeed in mutations.ts: this needs a live
// connection and current stock, so it runs directly rather than through the
// offline queue.
export const useManualFeed = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ManualFeedInput) => manualFeed(input),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ["feedDayStatus", input.herd] });
      qc.invalidateQueries({ queryKey: ["herdFeedInfo", input.herd] });
      // A genuinely tuned submit mints a new BOM (`tuned_bom` only reuses one
      // when the lines match exactly) — refetch so it shows up in the recipe
      // picker without waiting out the 15s stale time or restarting the app.
      qc.invalidateQueries({ queryKey: ["herdRecipes", input.herd] });
    },
  });
};
