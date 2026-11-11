import { useState } from "react";

import { useRecordDraft } from "@/src/hooks/useRecordDraft";

/**
 * "Continue recording" for a shoat record screen: the herd, the day and the
 * screen's own entry are kept when it is left by a tab switch, and put back
 * when the pill is tapped (the draft's route is the shoats one, so it returns
 * there). The herd and day alone are not input; `filled` says whether the entry
 * is. A shoat screen stays open after a save, keeping some fields for the next
 * entry: call `saved()` with the save so what is left is not kept as a draft
 * until something is changed again.
 */
export function useShoatDraft<E extends Record<string, unknown>>({
  title,
  herd,
  day,
  entry,
  filled,
  restore,
}: {
  title: string;
  herd: { name: string; setName: (n: string) => void };
  day: { picked: string; setPicked: (d: string) => void };
  entry: E;
  filled: boolean;
  restore: (e: E) => void;
}): { saved: () => void } {
  const json = JSON.stringify(entry);
  // The entry as it stood after the last save; "arm" takes it on the render the save resets.
  const [base, setBase] = useState<string | null>(null);
  const [arm, setArm] = useState(false);
  if (arm) {
    setArm(false);
    setBase(json);
  }
  useRecordDraft({
    title,
    state: { herd: herd.name, day: day.picked, entry },
    filled: filled && json !== base,
    restore: (d) => {
      herd.setName(d.herd);
      day.setPicked(d.day);
      restore(d.entry);
    },
  });
  return { saved: () => setArm(true) };
}
