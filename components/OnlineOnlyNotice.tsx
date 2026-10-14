import React from "react";

import { Banner } from "@/components/Banner";
import { useNetworkStatus } from "@/src/hooks/useNetworkStatus";

/** True only when the device knows it has no connection (unknown counts as online). */
export const useOffline = (): boolean => useNetworkStatus() === false;

/**
 * Shown on every record screen except milking while the phone is offline.
 * Only milking may be queued; everything else moves stock or is checked by
 * the server live, so it needs a connection. Pair it with `disabled` on the
 * save button.
 */
export function OnlineOnlyNotice() {
  if (!useOffline()) return null;
  return (
    <Banner tone="warning" icon="wifi-off">
      Needs a connection — this records stock and is checked by the server live.
    </Banner>
  );
}
