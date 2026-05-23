import { useQuery } from "@tanstack/react-query";

import { getDefaultCompany } from "@/src/frappe/livestockSettings";

/**
 * Pulls `Livestock Settings.custom_default_company` once per session. Used as
 * the default for write forms (Calf Feeding, Animal Diagnosis, Health Case)
 * that require a `company` field.
 */
export const useDefaultCompany = () =>
  useQuery({
    queryKey: ["settings", "default_company"],
    queryFn: getDefaultCompany,
    staleTime: 30 * 60_000,
  });
