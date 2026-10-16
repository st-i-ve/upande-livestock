import { useQuery } from "@tanstack/react-query";

import {
  getLivestockSettings,
} from "@/src/frappe/livestockSettings";

export const useLivestockSettings = () =>
  useQuery({
    queryKey: ["livestock-settings"],
    queryFn: getLivestockSettings,
    staleTime: 30_000,
  });
