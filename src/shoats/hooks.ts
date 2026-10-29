import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { getShoatHerd, getShoatOptions, listShoatHerds } from "@/src/shoats/api";
import { speciesOf, useAnimalType } from "@/src/shoats/animalType";

/** The herds of the species this phone is working with (Sheep or Goats). */
export const useShoatHerds = () => {
  const type = useAnimalType((s) => s.type);
  const species = speciesOf(type ?? "cattle");
  return useQuery({
    queryKey: ["shoat-herds", species],
    queryFn: () => listShoatHerds(species),
    staleTime: 60_000,
    enabled: !!species,
  });
};

export const useShoatHerd = (name: string) =>
  useQuery({ queryKey: ["shoat-herd", name], queryFn: () => getShoatHerd(name), enabled: !!name, staleTime: 15_000 });

export const useShoatOptions = () => useQuery({ queryKey: ["shoat-options"], queryFn: getShoatOptions, staleTime: 5 * 60_000 });

/** Herd names and their picker labels, both ways. */
export const useHerdChoices = () => {
  const q = useShoatHerds();
  const herds = useMemo(() => q.data ?? [], [q.data]);
  const labelOf = (name: string) => {
    const h = herds.find((x) => x.name === name);
    return h ? `${h.label} · ${h.head} head` : "";
  };
  const nameOf = (label: string) => herds.find((h) => `${h.label} · ${h.head} head` === label)?.name ?? "";
  return { herds, labels: herds.map((h) => `${h.label} · ${h.head} head`), labelOf, nameOf, ...q };
};
