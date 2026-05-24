import AsyncStorage from "@react-native-async-storage/async-storage";

export const STORAGE_KEYS = {
  COOKIE: "cookie",
  SID: "sid",
  INSTANCE_URL: "instanceurl",
  INSTANCE_URL_BACKUP: "instanceurl_backup",
  EMAIL: "email",
  FULLNAME: "fullname",
  PENDING_QUEUE: "pending_queue",
  /** Last manufacturing warehouse used for TMR feeding Work Orders. */
  FEED_WIP_WAREHOUSE: "feed_wip_warehouse",
} as const;

export const DEFAULT_INSTANCE_URL = "https://upande-kaitet2.c.frappe.cloud";

export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (e) {
      console.error("[storage] read failed", key, e);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.error("[storage] write failed", key, e);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.error("[storage] remove failed", key, e);
    }
  },

  async multiRemove(keys: string[]): Promise<void> {
    try {
      await AsyncStorage.multiRemove(keys);
    } catch (e) {
      console.error("[storage] multiRemove failed", e);
    }
  },
};
