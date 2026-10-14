import { useQuery } from "@tanstack/react-query";

import { getPostingDay } from "@/src/frappe/postingDay";
import { todayISO } from "@/src/services/api";

/**
 * Whether backdating is open, and the server's today. Closed until the server
 * (or the last remembered answer, when offline) says otherwise. Refetched each
 * time a screen mounts and on reconnect, so a manager closing the window shows
 * up on the next screen the operator opens.
 */
export const useBackdatingWindow = (): { open: boolean; today: string; ready: boolean } => {
  const { data, isSuccess } = useQuery({
    queryKey: ["posting-day"],
    queryFn: getPostingDay,
    staleTime: 0,
    refetchOnMount: "always",
    networkMode: "always",
  });
  return {
    open: data?.backdatingOpen ?? false,
    today: data?.today ?? todayISO(),
    ready: isSuccess,
  };
};
