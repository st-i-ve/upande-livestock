import { Alert } from "react-native";

import { showAppAlert } from "./alertCore.ts";

export * from "./alertCore.ts";

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
