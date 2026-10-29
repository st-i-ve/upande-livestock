import type { QueryClient } from "@tanstack/react-query";

/** After any recording the herd lists and the open herd page are stale. */
export const refreshShoats = (qc: QueryClient) => {
  qc.invalidateQueries({ queryKey: ["shoat-herds"] });
  qc.invalidateQueries({ queryKey: ["shoat-herd"] });
  qc.invalidateQueries({ queryKey: ["shoat-options"] });
};
