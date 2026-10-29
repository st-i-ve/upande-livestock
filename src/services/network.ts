/**
 * Whether a failed request never reached the server (dead network, DNS, timeout).
 * Mutara records need a live connection: nothing is queued, so this only decides
 * the wording of the error the operator sees.
 */
export const isOfflineError = (err: unknown): boolean => {
  const e = err as any;
  if (!e) return false;
  // An operations endpoint that answers `{error: "..."}` does so with HTTP 200 and
  // no axios response attached; that is a refusal, not a dead network.
  if (e.isServerRejection) return false;
  if (!e.response) return true;
  if (e.code === "ECONNABORTED" || e.code === "ERR_NETWORK") return true;
  return false;
};
