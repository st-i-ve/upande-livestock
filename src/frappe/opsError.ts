/**
 * An application-level rejection from a whitelisted operations endpoint.
 *
 * The offline queue decides whether to replay a mutation by asking whether the
 * error had an HTTP response — no response means the request never landed. An
 * endpoint that answers `{error: "..."}` DID land, with HTTP 200, so a plain
 * Error would look exactly like being offline and a refused entry would be
 * queued and retried forever. This flag is how the two are told apart.
 */
export class OpsError extends Error {
  /** Read by isOfflineError: the server answered, so this is not a network fault. */
  readonly isServerRejection = true;

  constructor(message: string) {
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
  }
}
