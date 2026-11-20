import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { countAnimals } from "@/src/db/animals";
import { useNetworkStatus } from "@/src/hooks/useNetworkStatus";
import { useRecordDrafts } from "@/src/record/draft";
import { usePendingQueue } from "@/src/hooks/useQueueStatus";
import { summaryText } from "@/src/sync/syncStatus";
import { useSyncStore } from "@/src/sync/syncStore";

/** The clock, re-read every `everyMs` (aligned to the minute by default). */
function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    // First tick on the next whole minute, so "2 min ago" turns when it should.
    const t = setTimeout(() => {
      setNow(Date.now());
      id = setInterval(() => setNow(Date.now()), everyMs);
    }, everyMs - (Date.now() % everyMs));
    return () => {
      clearTimeout(t);
      if (id) clearInterval(id);
    };
  }, [everyMs]);
  return now;
}

/**
 * The quiet line in the sync bar's place: what the phone holds and how fresh it
 * is. the animals on the phone (local store) and the last animals sync.
 * Plus any record kept for Continue recording.
 */
export function useSyncSummary(): string {
  const now = useNow();
  const online = useNetworkStatus();
  const animalsSyncedAt = useSyncStore((s) => s.animalsSyncedAt);
  const animalsError = useSyncStore((s) => s.animalsError);
  const queue = usePendingQueue();
  const waiting = useRecordDrafts((s) => (s.draft?.pending ? 1 : 0));

  // Invalidated with ["animals"] after every sync, so the count follows it.
  const count = useQuery({ queryKey: ["animals", "count"], queryFn: countAnimals, staleTime: 30_000 });
  return summaryText({
    what: { animals: count.data ?? null },
    syncedAt: animalsSyncedAt,
    failed: !!animalsError,
    offline: online === false,
    now,
    waiting,
    queued: queue.length,
    attention: queue.filter((i) => i.status === "attention").length,
  });
}
