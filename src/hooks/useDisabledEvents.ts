import { useEffect, useState } from "react";

import { useBootstrap } from "@/src/hooks/useHerds";
import { disabledEventsNow, loadDisabledEvents, rememberDisabledEvents } from "@/src/services/disabledEvents";

/**
 * Event types this farm switched off (the bootstrap bundle's `disabled_events`).
 * The last answer is kept on the phone, so menus stay filtered offline.
 */
export function useDisabledEvents(): string[] {
  const { data } = useBootstrap();
  const [kept, setKept] = useState<string[]>(disabledEventsNow);
  useEffect(() => {
    let live = true;
    loadDisabledEvents().then((list) => live && setKept(list));
    return () => {
      live = false;
    };
  }, []);
  const fresh = data?.disabledEvents;
  const freshKey = fresh ? JSON.stringify(fresh) : null;
  useEffect(() => {
    if (fresh) rememberDisabledEvents(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshKey]);
  return fresh ?? kept;
}
