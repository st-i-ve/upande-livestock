import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  LivestockSettingsDoc,
  getLivestockSettings,
  updateLivestockSettings,
} from "@/src/frappe/livestockSettings";

export const useLivestockSettings = () =>
  useQuery({
    queryKey: ["livestock-settings"],
    queryFn: getLivestockSettings,
    staleTime: 5 * 60_000,
  });

export const useUpdateLivestockSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<LivestockSettingsDoc>) => updateLivestockSettings(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["livestock-settings"] });
      qc.invalidateQueries({ queryKey: ["settings", "default_company"] });
    },
  });
};
