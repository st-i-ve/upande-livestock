import { create } from "zustand";

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

  setEmployeeName: async (name) => {
    if (name) await storage.setItem(STORAGE_KEY_EMPLOYEE, name);
    else await storage.removeItem(STORAGE_KEY_EMPLOYEE);
    set({ employeeName: name });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const [cookie, url, email, fullname, employee] = await Promise.all([
        storage.getItem(STORAGE_KEYS.COOKIE),
        storage.getItem(STORAGE_KEYS.INSTANCE_URL),
        storage.getItem(STORAGE_KEYS.EMAIL),
        storage.getItem(STORAGE_KEYS.FULLNAME),
        storage.getItem(STORAGE_KEY_EMPLOYEE),
      ]);
      set({
        isAuthenticated: !!cookie,
        instanceUrl: url || "",
        email,
        fullname,
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
    await api.logout();
    queryClient.clear();
    await storage.removeItem(STORAGE_KEY_EMPLOYEE);
    set({
      isAuthenticated: false,
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
