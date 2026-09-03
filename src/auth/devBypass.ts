/**
 * DEV-ONLY auth bypass, for testing navigation and layout without a Frappe
 * session.
 *
 * There is no cookie behind this session, so every authenticated request will
 * come back 401: the animals list stays empty and livestock events will not
 * submit. That is the accepted trade — this exists to walk the UI, not to
 * exercise the backend. Use a real login for anything touching data.
 *
 * `__DEV__` is false in any production build, so this cannot ship enabled.
 * To remove the feature entirely, delete this file and the handful of call
 * sites that import it.
 */
export const DEV_AUTH_BYPASS = __DEV__;

/** Marks a faked session in storage so it survives a reload the way a real
 *  cookie would. Cleared on logout. */
export const DEV_FAKE_SESSION_KEY = "dev_fake_session";

export const DEV_FAKE_USER = {
  email: "dev@upande.local",
  fullname: "Dev Tester",
} as const;
