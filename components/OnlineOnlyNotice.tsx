import React from "react";

import { Banner } from "@/components/Banner";
import { useNetworkStatus } from "@/src/hooks/useNetworkStatus";

/** True only when the device knows it has no connection (unknown counts as online). */
export const useOffline = (): boolean => useNetworkStatus() === false;

/**
 * Shown on every record screen while the phone is offline. Nothing is queued:
 * every entry is checked by the server live, so recording needs a connection.
 * Pair it with `disabled` on the save button.
 */
export function OnlineOnlyNotice() {
  if (!useOffline()) return null;
  return (
    <Banner tone="warning" icon="wifi-off">
      Recording needs a connection — the server checks every entry live.
    </Banner>
  );
}

/**
 * Shown on a record screen while the phone is offline. Saving still works: the
 * recording is written to the phone first and sent when there is signal.
 */
export function OfflineNotice() {
  if (!useOffline()) return null;
  return (
    <Banner tone="info" icon="wifi-off">
      No connection. What you save is kept on this phone and sent when you are back online.
    </Banner>
  );
}
