import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { extractFrappeError } from "@/src/services/api";
import type { RecordResult } from "@/src/shoats/api";
import { refreshShoats } from "@/src/shoats/invalidate";

/** Busy, error and result for one shoat entry; refreshes the herd lists after a save. */
export function useSubmit() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecordResult | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const run = async (fn: () => Promise<RecordResult>, saved: (r: RecordResult) => string): Promise<boolean> => {
    setError(null);
    setResult(null);
    setNote(null);
    setBusy(true);
    try {
      const r = await fn();
      setResult(r);
      setNote(saved(r));
      refreshShoats(qc);
      return true;
    } catch (e) {
      setError(extractFrappeError(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, result, note, run, setError };
}
