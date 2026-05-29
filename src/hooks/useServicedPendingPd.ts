import { useQuery } from "@tanstack/react-query";

import { getServicedPendingPdAnimalIds } from "@/src/frappe/breeding";

/**
 * Drives the PD screen's animal picker filter. Cached for 5 minutes so
 * reopening the picker after a quick navigation doesn't re-hit Frappe.
 */
export function useServicedPendingPd() {
  return useQuery({
    queryKey: ["breeding", "serviced-pending-pd"],
    queryFn: getServicedPendingPdAnimalIds,
    staleTime: 5 * 60 * 1000,
  });
}
