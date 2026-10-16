import { useQuery } from "@tanstack/react-query";

import { getHealthOptions } from "@/src/frappe/healthOptions";

/** The health screens' dropdowns and per-event stock lists, in one cached call. */
export const useHealthOptions = () =>
  useQuery({
    queryKey: ["health-options"],
    queryFn: getHealthOptions,
    staleTime: 30_000,
  });
