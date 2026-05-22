import { useQuery } from "@tanstack/react-query";

import { getHerd } from "@/src/frappe/herd";

export const useHerd = (name: string | undefined) =>
  useQuery({
    queryKey: ["herd", name],
    queryFn: () => getHerd(name!),
    enabled: !!name,
    staleTime: 60_000,
  });
