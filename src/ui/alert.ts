import { Alert, type AlertButton, type AlertOptions } from "react-native";
import { create } from "zustand";

/**
 * The app's own alert: React Native's `Alert.alert` drawn as a themed card
 * (components/AppAlertHost.tsx) instead of the Android system dialog. Same API
 * and the same meaning:
 *
 *   Alert.alert(title, message?, buttons?, options?)
 *
 * - no buttons: one "OK";
 * - the buttons in the order given, each closing the alert, then its onPress;
 * - `options.cancelable` (Android's own default false): a tap on the dimmed
 *   backdrop or the back button closes it and calls `options.onDismiss`;
 *   otherwise the back button presses the 'cancel' button when there is one
 *   and does nothing when there is not;
 * - several at once are shown one after another, in the order asked.
 */
export type AppAlertButton = Pick<AlertButton, "text" | "onPress" | "style" | "isPreferred">;
export type AppAlertOptions = Pick<AlertOptions, "cancelable" | "onDismiss">;

export type AppAlert = {
  id: number;
  title: string;
  message?: string;
  buttons: AppAlertButton[];
  options: AppAlertOptions;
};

type AlertQueue = {
  queue: AppAlert[];
  push: (a: AppAlert) => void;
  /** The alert on screen is closed: the next one, if any, takes its place. */
  shift: (id: number) => void;
};

export const useAppAlerts = create<AlertQueue>((set) => ({
  queue: [],
  push: (a) => set((s) => ({ queue: [...s.queue, a] })),
  shift: (id) => set((s) => ({ queue: s.queue.filter((a) => a.id !== id) })),
}));

let nextId = 1;

export function showAppAlert(
  title?: string | null,
  message?: string | null,
  buttons?: AppAlertButton[] | null,
  options?: AppAlertOptions | null,
): void {
  const list = buttons && buttons.length > 0 ? buttons : [{ text: "OK" }];
  useAppAlerts.getState().push({
    id: nextId++,
    title: title == null ? "" : String(title),
    message: message == null || message === "" ? undefined : String(message),
    buttons: list.map((b) => ({ ...b, text: b.text ?? "OK" })),
    options: options ?? {},
  });
}

/** What the Android back button does to `a`: a button to press, "dismiss", or nothing. */
export function backAction(a: AppAlert): AppAlertButton | "dismiss" | null {
  if (a.options.cancelable) return "dismiss";
  return a.buttons.find((b) => b.style === "cancel") ?? null;
}

/** The system dialog, kept for anything that really needs it. */
export const nativeAlert = Alert.alert.bind(Alert);

let installed = false;

/** Make `Alert.alert` the app's alert, everywhere (screens, libraries). Once, at startup. */
export function installAppAlert(): void {
  if (installed) return;
  installed = true;
  (Alert as { alert: typeof Alert.alert }).alert = (title, message, buttons, options) =>
    showAppAlert(title, message, buttons, options);
}
