import { useQuery } from "@tanstack/react-query";

import { getAnimal, getAnimalProfile } from "@/src/frappe/animal";
import { getStanding } from "@/src/frappe/standing";

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

/** How she stands against her herd and group. Falls back to the last saved answer offline. */
export const useAnimalStanding = (id: string | undefined) =>
  useQuery({
    queryKey: ["animal-standing", id],
    queryFn: () => getStanding(id!),
    enabled: !!id,
    staleTime: 5 * 60_000,
    retry: 0,
    networkMode: "always",
  });
