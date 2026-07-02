import { create } from "zustand";

import { cleanErrorMessage } from "@/src/services/errorMessage";

// A drop-in, app-themed replacement for the OS Alert. Any code can call
// appAlert(...) imperatively; a single AppAlertHost mounted at the root renders
// the themed modal. Messages are run through the translator so raw server/HTML
// text (e.g. "<strong>...</strong>") never reaches the user.

export type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

export type AlertConfig = {
  title: string;
  message?: string;
  buttons: AlertButton[];
};

interface AlertState {
  current: AlertConfig | null;
  show: (c: AlertConfig) => void;
  hide: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  current: null,
  show: (c) => set({ current: c }),
  hide: () => set({ current: null }),
}));

// Signature mirrors React Native's Alert.alert(title, message?, buttons?).
export function appAlert(title: string, message?: string, buttons?: AlertButton[]) {
  useAlertStore.getState().show({
    title,
    message: message != null ? cleanErrorMessage(message) : undefined,
    buttons: buttons && buttons.length ? buttons : [{ text: "OK" }],
  });
}
