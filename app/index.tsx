import { Redirect } from "expo-router";
import React from "react";

/**
 * The route for `/`, which is where the app cold-starts.
 *
 * This used to be `(tabs)/index.tsx` — the Home dashboard. `(tabs)` is a route
 * group, so parentheses add no path segment and that file was serving `/`.
 * Deleting Home therefore deleted the entry route, and a fresh launch landed on
 * expo-router's `+not-found` screen ("Unmatched Route") before any layout could
 * redirect: the AuthGate in `_layout.tsx` only runs once a route has matched.
 *
 * It lives at the root rather than back inside `(tabs)` so it cannot show up as
 * a phantom tab — the tab layout no longer declares an `index` screen.
 *
 * Sending everyone to login is deliberate and matches `unstable_settings.anchor`:
 * the AuthGate bounces straight to the Animals tab when a session already
 * exists, so protected content is never rendered before `checkAuth` resolves.
 */
export default function Index() {
  return <Redirect href="/(auth)/login" />;
}
