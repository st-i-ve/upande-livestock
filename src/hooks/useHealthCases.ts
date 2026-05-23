import { useQuery } from "@tanstack/react-query";

import { countOpenHealthCases, getHealthCases } from "@/src/frappe/animalHealthCase";

export const useHealthCases = () =>
  useQuery({
    queryKey: ["health-cases"],
    queryFn: () => getHealthCases(),
    staleTime: 60_000,
  });

export const useOpenHealthCaseCount = () =>
  useQuery({
    queryKey: ["health-cases", "open-count"],
    queryFn: countOpenHealthCases,
    staleTime: 60_000,
  });
