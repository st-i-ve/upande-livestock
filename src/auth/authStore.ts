import { create } from "zustand";

import { api, setUnauthorizedHandler } from "@/src/services/api";
import { queryClient } from "@/src/services/queryClient";
import {
  DEFAULT_INSTANCE_URL,
  STORAGE_KEYS,
  storage,
} from "@/src/services/storage";

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  instanceUrl: string;
  email: string | null;
  fullname: string | null;

  checkAuth: () => Promise<void>;
  login: (email: string, password: string, url?: string) => Promise<void>;
  logout: () => Promise<void>;
  setInstanceUrl: (url: string) => Promise<void>;
  handleUnauthorized: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isLoading: true,
  instanceUrl: DEFAULT_INSTANCE_URL,
  email: null,
  fullname: null,

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const [cookie, url, email, fullname] = await Promise.all([
        storage.getItem(STORAGE_KEYS.COOKIE),
        storage.getItem(STORAGE_KEYS.INSTANCE_URL),
        storage.getItem(STORAGE_KEYS.EMAIL),
        storage.getItem(STORAGE_KEYS.FULLNAME),
      ]);
      set({
        isAuthenticated: !!cookie,
        instanceUrl: url || DEFAULT_INSTANCE_URL,
        email,
        fullname,
      });
    } catch (e) {
      console.error("[auth] checkAuth failed", e);
      set({ isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email, password, url) => {
    const target = url || get().instanceUrl || DEFAULT_INSTANCE_URL;
    const data = await api.login(email, password, target);
    set({
      isAuthenticated: true,
      instanceUrl: target,
      email,
      fullname: data?.full_name ?? null,
    });
  },

  logout: async () => {
    await api.logout();
    queryClient.clear();
    set({
      isAuthenticated: false,
      email: null,
      fullname: null,
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
