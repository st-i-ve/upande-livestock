import { QueryClient, focusManager } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

// React Native has no window focus: tell TanStack when the app comes back to
// the foreground, so a stale list (stock, vets, settings) is refetched then.
// One event per foreground, not a timer.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => focusManager.setFocused(state === "active"));
}
