import { useEffect, useState } from "react";

import { PendingMutation, subscribe } from "@/src/offline/queue";

export const usePendingQueue = (): PendingMutation[] => {
  const [queue, setQueue] = useState<PendingMutation[]>([]);
  useEffect(() => subscribe(setQueue), []);
  return queue;
};

export const usePendingCount = (): number => usePendingQueue().length;
