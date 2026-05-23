import { useQuery } from "@tanstack/react-query";

import { getDisposals } from "@/src/frappe/animalDisposal";

export const useSales = () =>
  useQuery({
    queryKey: ["disposals", "sold"],
    queryFn: () => getDisposals({ soldOnly: true }),
    staleTime: 60_000,
  });

export const useCulls = () =>
  useQuery({
    queryKey: ["disposals", "culls"],
    queryFn: () => getDisposals({ cullsOnly: true }),
    staleTime: 60_000,
  });
