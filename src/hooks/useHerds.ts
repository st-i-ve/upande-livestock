import { useQuery } from "@tanstack/react-query";

import { getHerds } from "@/src/frappe/herd";

export const useHerds = () =>
  useQuery({
    queryKey: ["herds"],
    queryFn: getHerds,
    staleTime: 5 * 60_000,
  });
