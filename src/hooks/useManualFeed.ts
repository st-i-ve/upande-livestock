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
    },
  });
};
