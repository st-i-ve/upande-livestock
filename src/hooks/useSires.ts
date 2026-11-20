import { useQuery } from "@tanstack/react-query";

import { getSires } from "@/src/frappe/sires";

/** The active Livestock Sires, cached on the phone for offline. */
export const useSires = () =>
  useQuery({
    queryKey: ["sires"],
    queryFn: getSires,
    staleTime: 60_000,
  });
