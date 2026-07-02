import { router } from "expo-router";

import { appAlert } from "@/src/ui/appAlert";

// Shared success confirmation for every "record an event" flow. Instead of
// navigating to a separate success page, we surface the themed appAlert modal
// on top of the same form with two actions:
//   • Record another — dismisses and resets the form (onAnother), staying put
//   • Done           — returns to the app home
// This keeps the record stack shallow (no lingering success route) and makes
// logging several events in a row a single tap.
export function recordSuccess(opts: {
  title: string;
  message?: string;
  onAnother?: () => void;
  anotherLabel?: string;
}) {
  const { title, message, onAnother, anotherLabel = "Record another" } = opts;
  appAlert(title, message, [
    ...(onAnother
      ? [{ text: anotherLabel, style: "cancel" as const, onPress: onAnother }]
      : []),
    { text: "Done", onPress: () => router.replace("/(tabs)") },
  ]);
}
