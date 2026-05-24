import { useQuery } from "@tanstack/react-query";

import { getItemSnapshot } from "@/src/frappe/item";

export const useItemSnapshot = (name: string | null) =>
  useQuery({
    queryKey: ["item-snapshot", name ?? ""],
    queryFn: () => getItemSnapshot(name ?? ""),
    enabled: !!name,
    staleTime: 5 * 60_000,
  });
