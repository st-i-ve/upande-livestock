import { useMemo } from "react";

import { partsOf, useSyncStore } from "@/src/sync/syncStore";

/** What is syncing now, in the store's parts, as one stable list. */
export function useSyncParts() {
  const parts = useSyncStore((s) => s.parts);
  return useMemo(() => partsOf(parts), [parts]);
}
