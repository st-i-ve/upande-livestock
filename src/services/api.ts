import axios, { AxiosError, AxiosInstance } from "axios";

import { STORAGE_KEYS, storage } from "./storage";

const normalizeBaseUrl = (url: string) => url.trim().replace(/\/+$/, "");

const previewPayload = (value: unknown, max = 2000): string => {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  try {
    const s = typeof value === "string" ? value : JSON.stringify(value);
    return s.length > max ? `${s.slice(0, max)}…[+${s.length - max} chars]` : s;
  } catch {
    return "[unserializable]";
  }
};

const resolveUrl = (config: any): string => {
  const base = String(config?.baseURL ?? "").replace(/\/+$/, "");
  const path = String(config?.url ?? "");
  return /^https?:\/\//i.test(path) ? path : `${base}${path}`;
};

const attachLogging = (instance: AxiosInstance | typeof axios) => {
  instance.interceptors.request.use((config) => {
    const method = String(config.method ?? "get").toUpperCase();
    const parts = [`[API] → ${method} ${resolveUrl(config)}`];
    if (config.params) parts.push(`params=${previewPayload(config.params)}`);
    if (config.data !== undefined) parts.push(`body=${previewPayload(config.data)}`);
    console.log(parts.join(" "));
    return config;
  });
  instance.interceptors.response.use(
    (response) => {
      const method = String(response.config?.method ?? "get").toUpperCase();
      console.log(
        `[API] ← ${response.status} ${method} ${resolveUrl(response.config)} ${previewPayload(response.data)}`,
      );
      return response;
    },
    (error) => {
      const config = error.config ?? {};
      const method = String(config.method ?? "get").toUpperCase();
      const status = error.response?.status ?? "ERR";
      const detail =
        error.response?.data !== undefined
          ? previewPayload(error.response.data)
          : (error.message ?? "(no response)");
      console.warn(`[API] ✗ ${status} ${method} ${resolveUrl(config)} ${detail}`);
      return Promise.reject(error);
    },
  );
};

attachLogging(axios);

// Hook registered by authStore so the response interceptor can route to login
// on session expiry without a circular import.
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

// Frappe returns 401 when the session is genuinely gone, but it also returns
// 403 for two very different situations that must NOT be conflated:
//   (a) an authentication/CSRF failure (session dead) — should log out, and
//   (b) a plain PermissionError where a *valid* session simply lacks rights on
//       one doctype — must keep the session and surface the error instead.
// Treating every 403 as (a) is what booted logged-in users to the login screen.
const AUTH_EXC = /CSRFTokenError|AuthenticationError|SessionExpired|InvalidAuthorizationToken/i;

/** A response error that unambiguously means the session is no longer valid. */
const isAuthFailure = (err: AxiosError): boolean => {
  if (err.response?.status === 401) return true;
  const data = err.response?.data as any;
  const exc = String(data?.exc ?? data?.exception ?? "");
  return AUTH_EXC.test(exc);
};

/**
 * Confirms whether the stored session is still valid by asking Frappe who we
 * are. Returns false only if the session has actually expired (server answers
 * "Guest") or the probe itself is rejected. Uses a bare axios call so it never
 * re-enters the response interceptor and cannot recurse.
 */
const isSessionAlive = async (): Promise<boolean> => {
  try {
    const baseUrl = await storage.getItem(STORAGE_KEYS.INSTANCE_URL);
    if (!baseUrl) return false;
    const cookie = await storage.getItem(STORAGE_KEYS.COOKIE);
    const sid = await storage.getItem(STORAGE_KEYS.SID);
    const headers: Record<string, string> = {};
    if (cookie) headers["Cookie"] = cookie;
    if (sid) headers["sid"] = sid;
    const res = await axios.get(
      `${normalizeBaseUrl(baseUrl)}/api/method/frappe.auth.get_logged_user`,
      { headers, timeout: 10_000 },
    );
    const user = res.data?.message;
    return !!user && user !== "Guest";
  } catch {
    return false;
  }
};

/**
 * Frappe wraps validation messages inside `_server_messages` as a JSON string
 * of JSON strings, so we double-decode and pick the first message. Shared by
 * every helper below that needs the server's own wording.
 */
const parseServerMessages = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  try {
    const outer = JSON.parse(raw);
    const arr = Array.isArray(outer) ? outer : [outer];
    for (const item of arr) {
      try {
        const inner = typeof item === "string" ? JSON.parse(item) : item;
        if (inner?.message) return String(inner.message);
      } catch {
        if (typeof item === "string") return item;
      }
    }
  } catch {
    // fall through
  }
  return null;
};

/**
 * Returns a single user-readable string from a Frappe error response.
 */
export const extractFrappeError = (err: unknown): string => {
  const e = err as AxiosError;
  const data = e?.response?.data as any;
  const serverMessage = parseServerMessages(data?._server_messages);
  if (serverMessage) return serverMessage;
  if (data?.exception) return String(data.exception);
  if (data?.message) return String(data.message);
  if (e?.message) return e.message;
  return "Something went wrong.";
};

/** Reason category for a failed request, coarse enough to drive UI copy. */
export type ErrorReason =
  | "site_updating"
  | "invalid_credentials"
  | "forbidden"
  | "network_unreachable"
  | "invalid_site"
  | "server_message"
  | "unknown";

export interface ClassifiedError {
  reason: ErrorReason;
  message: string;
}

/** Axios's own boilerplate text — never worth showing verbatim. */
const isGenericAxiosMessage = (msg: string | undefined): boolean =>
  !!msg && /^(network error|request failed with status code \d+|timeout of \d+ms exceeded)$/i.test(msg.trim());

/**
 * A Frappe error response is JSON carrying at least one of these fields.
 * Anything else that answers the request (an HTML error page, a captive
 * portal, a completely different API) is not a Frappe site.
 */
const looksLikeFrappeResponse = (data: unknown): boolean => {
  if (!data || typeof data !== "object") return false;
  const d = data as any;
  return (
    d._server_messages !== undefined ||
    d.exception !== undefined ||
    d.exc !== undefined ||
    d.exc_type !== undefined ||
    d.message !== undefined
  );
};

/**
 * Classifies a failed request into a reason the UI can act on, and a message
 * safe to show the person holding the phone. Keeps the server's own wording
 * wherever Frappe sent something specific (validation errors like a
 * backdating refusal or a feed shortage are written for farm workers on
 * purpose) and only substitutes our own copy where the raw text would be
 * meaningless or actively misleading — most importantly, a site mid-update
 * (503/SessionStopped) must never read like a wrong password.
 */
export const classifyError = (err: unknown): ClassifiedError => {
  const e = err as AxiosError;
  const status = e?.response?.status;
  const data = e?.response?.data as any;
  const serverMessage = parseServerMessages(data?._server_messages);

  // No response at all: DNS failure, unreachable host, dropped connection,
  // or a timeout. Axios collapses all of these to a bare `err.message` with
  // no `response`.
  if (!e?.response) {
    const timedOut = e?.code === "ECONNABORTED" || /timeout/i.test(e?.message ?? "");
    return {
      reason: "network_unreachable",
      message: timedOut
        ? "The connection timed out. Check your internet connection and try again."
        : "Could not reach the server. Check your internet connection and the site address, then try again.",
    };
  }

  // Site is mid-update. Frappe answers 503/SessionStopped with the bare word
  // "Updating" — true, but it doesn't tell a farm worker to stop suspecting
  // their password, so we always replace it here.
  if (status === 503) {
    return {
      reason: "site_updating",
      message: "This site is being updated. It isn't your password — please try again in a few minutes.",
    };
  }

  // Genuinely wrong credentials. Frappe's own "Invalid login credentials" is
  // clear, so keep it; only fall back to our own wording if it's missing.
  if (status === 401) {
    return {
      reason: "invalid_credentials",
      message: serverMessage || "Incorrect email or password. Please check and try again.",
    };
  }

  // A bare 403 is ambiguous (see the comment above isAuthFailure): it can mean
  // a dead session or a valid session lacking rights on one doctype. Either
  // way it is not a wrong password, so never word it like one.
  if (status === 403) {
    return {
      reason: "forbidden",
      message: serverMessage || "You don't have permission to sign in with this account. Contact your administrator.",
    };
  }

  if (serverMessage) {
    return { reason: "server_message", message: serverMessage };
  }

  if (!looksLikeFrappeResponse(data)) {
    return {
      reason: "invalid_site",
      message: "This doesn't look like a Frappe site. Check the site address and try again.",
    };
  }

  if (data?.exception) return { reason: "unknown", message: String(data.exception) };
  if (data?.message) return { reason: "unknown", message: String(data.message) };

  const fallback = !isGenericAxiosMessage(e?.message) && e?.message ? e.message : "Something went wrong. Please try again.";
  return { reason: "unknown", message: fallback };
};

export const getWorkingUrl = async (inputUrl: string): Promise<string | null> => {
  const normalized = normalizeBaseUrl(inputUrl);
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const httpsUrl = `https://${normalized}`;
  try {
    await axios.head(httpsUrl, { timeout: 5000 });
    return httpsUrl;
  } catch {
    return `http://${normalized}`;
  }
};

export const getClient = async (): Promise<AxiosInstance> => {
  const baseUrl = await storage.getItem(STORAGE_KEYS.INSTANCE_URL);
  if (!baseUrl) {
    throw new Error("No Frappe instance URL set. Sign in to configure one.");
  }
  const cookie = await storage.getItem(STORAGE_KEYS.COOKIE);
  const sid = await storage.getItem(STORAGE_KEYS.SID);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cookie) headers["Cookie"] = cookie;
  if (sid) headers["sid"] = sid;
  if (cookie) {
    const m = cookie.match(/csrf_token=([^;]+)/i);
    if (m && m[1]) headers["X-Frappe-CSRF-Token"] = m[1];
  }

  const client = axios.create({
    baseURL: baseUrl,
    headers,
    timeout: 15_000,
  });
  attachLogging(client);

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const err = error as AxiosError;
      const fireUnauthorized = () => {
        if (!onUnauthorized) return;
        try {
          onUnauthorized();
        } catch (e) {
          console.warn("[api] onUnauthorized handler threw", e);
        }
      };
      if (onUnauthorized) {
        if (isAuthFailure(err)) {
          // Session is definitively gone (401 or an auth/CSRF exception).
          fireUnauthorized();
        } else if (err.response?.status === 403) {
          // A bare 403 is ambiguous: a permission gap on one doctype (keep the
          // session) vs. an expired session surfacing as Guest+PermissionError.
          // Probe who we are — only log out if the session is actually dead.
          const alive = await isSessionAlive();
          if (!alive) fireUnauthorized();
        }
      }
      return Promise.reject(err);
    },
  );

  return client;
};

const parseSetCookie = (raw: string[] | string | undefined): string => {
  if (!raw) return "";
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map((h) => {
      const parts = h.split(";");
      return parts[0] ? parts[0].trim() : "";
    })
    .filter(Boolean)
    .join("; ");
};

export const todayISO = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** ISO date `days` ago. Useful for rolling-window reports. */
export const isoDaysAgo = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/**
 * Pulls the first user-readable message Frappe attaches to a *successful*
 * response (via frappe.msgprint on the server). Returns null if there's
 * nothing useful.
 */
export const extractFrappeMessage = (response: any): string | null => {
  const data = response?.data ?? response;
  const msg = parseServerMessages(data?._server_messages);
  return msg ? msg.replace(/<[^>]+>/g, "") : null;
};

/**
 * Create + submit a Frappe doc in two steps. Returns the submitted doc.
 * Server scripts fire on submit.
 */
export const frappeCreateAndSubmit = async <T = any>(
  doctype: string,
  fields: Record<string, any>,
): Promise<T> => {
  const client = await getClient();
  const insertRes = await client.post("/api/method/frappe.client.insert", {
    doc: { doctype, ...fields },
  });
  const draft = insertRes.data?.message;
  if (!draft) throw new Error(`Frappe insert returned no document for ${doctype}`);
  const submitRes = await client.post("/api/method/frappe.client.submit", {
    doc: draft,
  });
  return (submitRes.data?.message ?? submitRes.data) as T;
};

/**
 * Insert a Frappe doc as Draft (docstatus=0). No submit step. Useful when
 * the caller wants to surface a draft for the user to review and submit
 * manually (e.g. Work Orders with insufficient stock).
 */
export const frappeInsertDraft = async <T = any>(
  doctype: string,
  fields: Record<string, any>,
): Promise<T> => {
  const client = await getClient();
  const insertRes = await client.post("/api/method/frappe.client.insert", {
    doc: { doctype, ...fields },
  });
  const draft = insertRes.data?.message;
  if (!draft) throw new Error(`Frappe insert returned no document for ${doctype}`);
  return draft as T;
};

export const api = {
  /**
   * Logs in to a Frappe site and persists the cookie + sid.
   * Returns the parsed login response so callers can grab `full_name`.
   */
  login: async (
    email: string,
    password: string,
    url: string,
  ): Promise<{ full_name?: string; message?: string }> => {
    const fullUrl = await getWorkingUrl(url);
    if (!fullUrl) throw new Error("Could not connect to server");

    await storage.setItem(STORAGE_KEYS.INSTANCE_URL, fullUrl);
    await storage.setItem(STORAGE_KEYS.INSTANCE_URL_BACKUP, fullUrl);

    const params = new URLSearchParams();
    params.append("usr", email);
    params.append("pwd", password);

    const response = await axios.post(`${fullUrl}/api/method/login`, params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 15_000,
    });

    const setCookie =
      (response.headers as any)["set-cookie"] ||
      (response.headers as any)["Set-Cookie"];
    const cookieStr = parseSetCookie(setCookie);

    if (cookieStr) {
      await storage.setItem(STORAGE_KEYS.COOKIE, cookieStr);
      const sidMatch = cookieStr.match(/sid=([^;]+)/);
      if (sidMatch?.[1]) await storage.setItem(STORAGE_KEYS.SID, sidMatch[1]);
    }

    await storage.setItem(STORAGE_KEYS.EMAIL, email);
    const data = response.data as { full_name?: string; message?: string };
    if (data?.full_name) await storage.setItem(STORAGE_KEYS.FULLNAME, data.full_name);

    return data;
  },

  logout: async (): Promise<void> => {
    try {
      const client = await getClient();
      await client.post("/api/method/logout");
    } catch {
      // ignore — we're clearing local state anyway
    }
    await storage.multiRemove([
      STORAGE_KEYS.COOKIE,
      STORAGE_KEYS.SID,
      STORAGE_KEYS.FULLNAME,
    ]);
  },
};
