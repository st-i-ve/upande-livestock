import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { queryAnimals } from "@/src/db/animals";
import { syncAnimals } from "@/src/db/sync";

/**
 * The animals, read from the phone's own SQLite copy — so lists, pickers and
 * search work with no signal. `networkMode: "always"` because the read never
 * touches the network; `syncAnimals` refreshes the table and invalidates this
 * query. `refetch` (pull-to-refresh) runs a delta sync first.
 */
export const useAnimals = (search?: string) => {
  const q = useQuery({
    queryKey: ["animals", search ?? ""],
    queryFn: () => queryAnimals(search),
    networkMode: "always",
    staleTime: Infinity,
    retry: false,
  });
  const refetch = useCallback(async () => {
    await syncAnimals();
    return q.refetch();
  }, [q]);
  return { ...q, refetch };
};
