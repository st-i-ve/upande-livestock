import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getVetOptions } from "@/src/frappe/vets";

/** Enabled vets and the logged-in user's own, in one cached call. */
export const useVets = () =>
  useQuery({
    queryKey: ["vets"],
    queryFn: getVetOptions,
    staleTime: 5 * 60_000,
  });

/**
 * The vets plus the chosen one, starting on the logged-in user's own vet record
 * and never overwritten once somebody has chosen. `vet` is "" when none is
 * chosen, which is sent as nothing.
 */
export const useVetChoice = () => {
  const q = useVets();
  // null until somebody chooses; "" is a deliberate "no vet".
  const [picked, setVet] = useState<string | null>(null);
  const vet = picked ?? q.data?.mine ?? "";
  const vets = q.data?.vets ?? [];
  return {
    vets,
    vet,
    setVet,
    /** The chosen vet is a farm employee, who is not paid a fee. */
    isInternal: vets.find((v) => v.id === vet)?.type === "Internal",
    loading: q.isLoading,
  };
};
