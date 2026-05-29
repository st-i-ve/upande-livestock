import { useQuery } from "@tanstack/react-query";

import { getAnimalHealthCase } from "@/src/frappe/animalHealthCase";

export function useAnimalHealthCase(name: string | undefined) {
  return useQuery({
    queryKey: ["health-case", name],
    queryFn: () => (name ? getAnimalHealthCase(name) : null),
    enabled: !!name,
  });
}
