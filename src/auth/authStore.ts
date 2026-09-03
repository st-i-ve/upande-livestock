import { create } from "zustand";

import { DEV_FAKE_SESSION_KEY, DEV_FAKE_USER } from "@/src/auth/devBypass";
import { getEmployeeForUser } from "@/src/frappe/employee";
import { api, setUnauthorizedHandler } from "@/src/services/api";
import { queryClient } from "@/src/services/queryClient";
import { STORAGE_KEYS, storage } from "@/src/services/storage";

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  instanceUrl: string;
  email: string | null;
  fullname: string | null;
  /** True while the DEV auth bypass is standing in for a real session. */
  isFakeSession: boolean;
  /** DEV only — enter the app with no backend session. See devBypass.ts. */
  devLogin: () => Promise<void>;
  /** Employee record name linked to the logged-in user, if any. Default
   *  operator for Animal Event submissions; can be overridden per form. */
  employeeName: string | null;
  /** Manual override — used when no Employee is linked to the user. */
  setEmployeeName: (name: string | null) => Promise<void>;

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
  isFakeSession: false,

  devLogin: async () => {
    await storage.setItem(DEV_FAKE_SESSION_KEY, "1");
    set({
      isAuthenticated: true,
      isFakeSession: true,
      email: DEV_FAKE_USER.email,
      fullname: DEV_FAKE_USER.fullname,
    });
  },

  setEmployeeName: async (name) => {
    if (name) await storage.setItem(STORAGE_KEY_EMPLOYEE, name);
    else await storage.removeItem(STORAGE_KEY_EMPLOYEE);
    set({ employeeName: name });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const [cookie, url, email, fullname, employee, fake] = await Promise.all([
        storage.getItem(STORAGE_KEYS.COOKIE),
        storage.getItem(STORAGE_KEYS.INSTANCE_URL),
        storage.getItem(STORAGE_KEYS.EMAIL),
        storage.getItem(STORAGE_KEYS.FULLNAME),
        storage.getItem(STORAGE_KEY_EMPLOYEE),
        storage.getItem(DEV_FAKE_SESSION_KEY),
      ]);
      // A faked session has no cookie, so it has to be restored explicitly or
      // every reload would drop back to the login screen.
      const isFake = __DEV__ && !!fake;
      set({
        isAuthenticated: !!cookie || isFake,
        isFakeSession: isFake,
        instanceUrl: url || "",
        email: isFake ? DEV_FAKE_USER.email : email,
        fullname: isFake ? DEV_FAKE_USER.fullname : fullname,
        employeeName: employee,
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

    // Best-effort: resolve the Employee linked to this user. If none, the
    // forms will surface an Employee picker. Either way, login still succeeds.
    let employeeName: string | null = null;
    try {
      const emp = await getEmployeeForUser(email);
      if (emp) {
        employeeName = emp.name;
        await storage.setItem(STORAGE_KEY_EMPLOYEE, emp.name);
      }
    } catch (e) {
      console.warn("[auth] Employee lookup failed", e);
    }

    set({
      isAuthenticated: true,
      instanceUrl: target,
      email,
      fullname: data?.full_name ?? null,
      employeeName,
    });
  },

  logout: async () => {
    // A faked session has nothing to end server-side, and api.logout() would
    // only produce a 401 of its own.
    if (!get().isFakeSession) await api.logout();
    await storage.removeItem(DEV_FAKE_SESSION_KEY);
    queryClient.clear();
    await storage.removeItem(STORAGE_KEY_EMPLOYEE);
    set({
      isAuthenticated: false,
      isFakeSession: false,
      email: null,
      fullname: null,
      employeeName: null,
    });
  },

  setInstanceUrl: async (url) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    await storage.setItem(STORAGE_KEYS.INSTANCE_URL, trimmed);
    set({ instanceUrl: trimmed });
  },

  handleUnauthorized: () => {
    // Every request under a faked session comes back 401. Honouring them would
    // bounce straight back to login on the first screen that loads data, which
    // would make the bypass useless. Swallow them and stay put.
    if (get().isFakeSession) return;
    queryClient.clear();
    storage
      .multiRemove([STORAGE_KEYS.COOKIE, STORAGE_KEYS.SID, STORAGE_KEYS.FULLNAME])
      .finally(() => {
        set({ isAuthenticated: false, fullname: null });
      });
  },
}));

// Wire the api response interceptor → store so session expiry routes to login.
setUnauthorizedHandler(() => useAuthStore.getState().handleUnauthorized());
