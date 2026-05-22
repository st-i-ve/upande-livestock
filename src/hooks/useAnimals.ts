import { useQuery } from "@tanstack/react-query";

import { getAnimals } from "@/src/frappe/animal";

export const useAnimals = () =>
  useQuery({
    queryKey: ["animals"],
    queryFn: getAnimals,
    staleTime: 60_000,
  });
