import { create } from "zustand";

import { cachedEmployeeStatus, fetchEmployeeStatus } from "@/src/frappe/employee";
import { isQualityOnly } from "@/src/auth/roles";
import { setNotEmployeeHandler } from "@/src/frappe/opsError";
import { clearLocalData, syncAnimals } from "@/src/db/sync";
import { api, setUnauthorizedHandler } from "@/src/services/api";
import { queryClient } from "@/src/services/queryClient";
import { STORAGE_KEYS, storage } from "@/src/services/storage";

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  instanceUrl: string;
  email: string | null;
  fullname: string | null;
  /** Employee record name linked to the logged-in user, if any. Default
   *  operator for Animal Event submissions; can be overridden per form. */
  employeeName: string | null;
  /** Manual override — used when no Employee is linked to the user. */
  setEmployeeName: (name: string | null) => Promise<void>;
  /** Whether an Employee is linked to this user. A user without one is
   *  view-only: the server refuses their records and the app hides the means.
   *  `null` until known; treated as "may record" so a first paint never flashes
   *  the restriction at an employee — the server decides either way. */
  isEmployee: boolean | null;
  /** The livestock roles the server says this user holds; `null` until known.
   *  Cached like `isEmployee`: a failed lookup keeps the last answer. */
  roles: string[] | null;
  /** Ask the server who this user is; offline, keep the last answer. */
  refreshEmployeeStatus: () => Promise<void>;

  checkAuth: () => Promise<void>;
  login: (email: string, password: string, url?: string) => Promise<void>;
  logout: () => Promise<void>;
  setInstanceUrl: (url: string) => Promise<void>;
  handleUnauthorized: () => void;
}

const STORAGE_KEY_EMPLOYEE = "operator_employee";

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isLoading: true,
  /** Empty on a fresh install — the user enters a Frappe site URL on the
   *  login screen. Persisted as soon as login is attempted. */
  instanceUrl: "",
  email: null,
  fullname: null,
  employeeName: null,
  isEmployee: null,
  roles: null,

  refreshEmployeeStatus: async () => {
    try {
      const st = await fetchEmployeeStatus();
      if (st.employee) await storage.setItem(STORAGE_KEY_EMPLOYEE, st.employee);
      else await storage.removeItem(STORAGE_KEY_EMPLOYEE);
      // A server that sent no roles must not erase the ones we know.
      set({
        isEmployee: st.isEmployee,
        employeeName: st.employee,
        roles: st.roles ?? get().roles,
      });
    } catch (e) {
      // Offline or the server is busy: keep what we last knew.
      console.warn("[auth] employee status refresh failed", e);
    }
  },

  setEmployeeName: async (name) => {
    if (name) await storage.setItem(STORAGE_KEY_EMPLOYEE, name);
    else await storage.removeItem(STORAGE_KEY_EMPLOYEE);
    set({ employeeName: name });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const [cookie, url, email, fullname, employee, status] = await Promise.all([
        storage.getItem(STORAGE_KEYS.COOKIE),
        storage.getItem(STORAGE_KEYS.INSTANCE_URL),
        storage.getItem(STORAGE_KEYS.EMAIL),
        storage.getItem(STORAGE_KEYS.FULLNAME),
        storage.getItem(STORAGE_KEY_EMPLOYEE),
        cachedEmployeeStatus(),
      ]);
      set({
        isAuthenticated: !!cookie,
        instanceUrl: url || "",
        email,
        fullname,
        employeeName: employee,
        isEmployee: status ? status.isEmployee : null,
        roles: status ? status.roles : null,
      });
    } catch (e) {
      console.error("[auth] checkAuth failed", e);
      set({ isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email, password, url) => {
    const target = (url || get().instanceUrl || "").trim();
    if (!target) {
      throw new Error("Enter a Frappe instance URL before signing in.");
    }
    const data = await api.login(email, password, target);

    // Who this user is on the farm's books, from the server and cached for
    // offline. No Employee means view-only. Login succeeds either way.
    let employeeName: string | null = null;
    let isEmployee: boolean | null = null;
    let roles: string[] | null = null;
    try {
      const st = await fetchEmployeeStatus();
      isEmployee = st.isEmployee;
      employeeName = st.employee;
      roles = st.roles;
      if (st.employee) await storage.setItem(STORAGE_KEY_EMPLOYEE, st.employee);
      else await storage.removeItem(STORAGE_KEY_EMPLOYEE);
    } catch (e) {
      console.warn("[auth] Employee lookup failed", e);
    }

    set({
      isAuthenticated: true,
      instanceUrl: target,
      email,
      fullname: data?.full_name ?? null,
      employeeName,
      isEmployee,
      roles,
    });
    // The whole herd, once, so the phone works offline from here on. Not
    // awaited: a slow sync must not hold up signing in. A user whose only role is
    // Livestock Quality may not read animals, so there is nothing to sync.
    if (!isQualityOnly(roles)) void syncAnimals({ full: true });
  },

  logout: async () => {
    await api.logout();
    queryClient.clear();
    await clearLocalData().catch((e) => console.warn("[auth] clearing local data failed", e));
    await storage.removeItem(STORAGE_KEY_EMPLOYEE);
    await storage.removeItem(STORAGE_KEYS.EMPLOYEE_STATUS);
    set({
      isAuthenticated: false,
      email: null,
      fullname: null,
      employeeName: null,
      isEmployee: null,
      roles: null,
    });
  },

  setInstanceUrl: async (url) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    await storage.setItem(STORAGE_KEYS.INSTANCE_URL, trimmed);
    set({ instanceUrl: trimmed });
  },

  handleUnauthorized: () => {
    queryClient.clear();
    storage
      .multiRemove([STORAGE_KEYS.COOKIE, STORAGE_KEYS.SID, STORAGE_KEYS.FULLNAME])
      .finally(() => {
        set({ isAuthenticated: false, fullname: null });
      });
  },
}));

// A server refusal for "not an employee" is the truth about this user: go
// view-only now, and remember it for offline.
setNotEmployeeHandler(() => {
  useAuthStore.setState({ isEmployee: false, employeeName: null });
  void storage.setItem(
    STORAGE_KEYS.EMPLOYEE_STATUS,
    JSON.stringify({
      isEmployee: false,
      employee: null,
      employeeName: null,
      roles: useAuthStore.getState().roles,
    }),
  );
});

// Wire the api response interceptor → store so session expiry routes to login.
setUnauthorizedHandler(() => useAuthStore.getState().handleUnauthorized());
