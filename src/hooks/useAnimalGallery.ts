import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getGallery } from "@/src/frappe/animalPhotos";

/** Her photographs, newest first; the last answer stands in offline. */
export const useAnimalGallery = (id: string | undefined) =>
  useQuery({
    queryKey: ["animal-gallery", id],
    queryFn: () => getGallery(id!),
    enabled: !!id,
    staleTime: 30_000,
    retry: 1,
    networkMode: "always",
  });

export const useRefreshGallery = () => {
  const qc = useQueryClient();
  return (id: string) => qc.invalidateQueries({ queryKey: ["animal-gallery", id] });
};
