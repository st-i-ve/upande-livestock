import { useQuery } from "@tanstack/react-query";

import { getLivestockStock } from "@/src/frappe/livestockStock";

/** The livestock stores' stock. Short staleness: refetched on focus, on
 *  foreground, on pull-to-refresh and after a save — never polled. */
export const useLivestockStock = () =>
  useQuery({
    queryKey: ["livestock-stock"],
    queryFn: getLivestockStock,
    staleTime: 30_000,
  });
