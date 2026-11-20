import { useQuery } from "@tanstack/react-query";

import { getAnimal, getAnimalFamily, getAnimalProfile } from "@/src/frappe/animal";
import { queryAnimals } from "@/src/db/animals";
import { localFamily, type Family } from "@/src/family";
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
    networkMode: "always",
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

/** Parents, offspring and a bull's record; offline, worked out from the phone's own animals. */
export const useAnimalFamily = (id: string | undefined) =>
  useQuery({
    queryKey: ["animal-family", id],
    queryFn: async (): Promise<Family | null> => {
      const got = await getAnimalFamily(id!);
      if (got) return got;
      const all = await queryAnimals();
      const me = all.find((a) => a.id === id);
      return me ? localFamily(me, all) : null;
    },
    enabled: !!id,
    staleTime: 60_000,
    retry: 0,
    networkMode: "always",
  });
