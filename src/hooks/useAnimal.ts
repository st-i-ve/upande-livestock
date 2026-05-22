import { useQuery } from "@tanstack/react-query";

import { getAnimal } from "@/src/frappe/animal";

export const useAnimal = (id: string | undefined) =>
  useQuery({
    queryKey: ["animal", id],
    queryFn: () => getAnimal(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
