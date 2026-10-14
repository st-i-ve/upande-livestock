import { useQuery } from "@tanstack/react-query";

import { getAnimal, getAnimalProfile } from "@/src/frappe/animal";

export const useAnimal = (id: string | undefined) =>
  useQuery({
    queryKey: ["animal", id],
    queryFn: () => getAnimal(id!),
    enabled: !!id,
    staleTime: 30_000,
  });

export const useAnimalProfile = (id: string | undefined) =>
  useQuery({
    queryKey: ["animal-profile", id],
    queryFn: () => getAnimalProfile(id!),
    enabled: !!id,
    staleTime: 60_000,
    retry: 1,
  });
