/**
 * An application-level rejection from a whitelisted operations endpoint.
 *
 * The offline queue decides whether to replay a mutation by asking whether the
 * error had an HTTP response — no response means the request never landed. An
 * endpoint that answers `{error: "..."}` DID land, with HTTP 200, so a plain
 * Error would look exactly like being offline and a refused entry would be
 * queued and retried forever. This flag is how the two are told apart.
 */
let onNotEmployee: (() => void) | null = null;

/** The auth store registers here so a server refusal for "not an employee"
 *  flips the app to view-only without every screen having to look for it. */
export const setNotEmployeeHandler = (fn: (() => void) | null) => {
  onNotEmployee = fn;
};

export const NOT_EMPLOYEE_CODE = "not_employee";

export class OpsError extends Error {
  /** The server's stable reason for the refusal, when it gave one. */
  readonly code?: string;

  /** Whatever else the refusal carried (the birth window's dates, who may
   *  back-record a service — see src/breeding/birthWindow). */
  readonly details?: Record<string, any>;

  /** Read by isOfflineError: the server answered, so this is not a network fault. */
  readonly isServerRejection = true;

  constructor(message: string, code?: string, details?: Record<string, any>) {
    // Server guards write their messages for the desk, in HTML — "<b>❌ No
    // Active Pregnancy Found!</b><br><br>...". On a phone that renders as
    // tag soup, so the markup comes out here and the text stays.
    super(
      String(message ?? "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|li)>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\n{3,}/g, "\n\n")
        .trim() || "The server refused the entry.",
    );
    this.name = "OpsError";
    this.code = code;
    this.details = details;
    if (code === NOT_EMPLOYEE_CODE) onNotEmployee?.();
  }
}
