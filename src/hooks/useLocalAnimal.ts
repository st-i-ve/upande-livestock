import { useQuery } from "@tanstack/react-query";

import { getLocalAnimal } from "@/src/db/animals";

/** One animal from the local store (works offline). */
export const useLocalAnimal = (id: string | undefined) =>
  useQuery({
    queryKey: ["animals", "one", id],
    queryFn: () => getLocalAnimal(id!),
    enabled: !!id,
    networkMode: "always",
    staleTime: Infinity,
    retry: false,
  });
