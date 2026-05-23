import { useQuery } from "@tanstack/react-query";

import { getDiagnoses } from "@/src/frappe/animalDiagnosis";

export const useDiagnoses = () =>
  useQuery({
    queryKey: ["diagnoses"],
    queryFn: () => getDiagnoses(),
    staleTime: 60_000,
  });
