import React, { createContext, useContext, useMemo, useState } from "react";

import { todayISO } from "@/src/services/api";

type BackdateContextValue = {
  isBackdating: boolean;
  /** ISO `YYYY-MM-DD`. Only meaningful when `isBackdating` is true. */
  eventDate: string;
  setEventDate: (iso: string) => void;
};

const DEFAULT: BackdateContextValue = {
  isBackdating: false,
  eventDate: "",
  setEventDate: () => {},
};

const BackdateContext = createContext<BackdateContextValue>(DEFAULT);

/**
 * How an event screen finds out it is being rendered on the backdating route
 * rather than its own live route. Outside `BackdateProvider` — i.e. every
 * live `record/events/*` screen — this returns the inert default
 * (`isBackdating: false`), so a screen gates every backdate-specific bit of
 * UI and every use of `eventDate` on that flag and the live path is
 * untouched.
 */
export function useBackdate(): BackdateContextValue {
  return useContext(BackdateContext);
}

/**
 * Mounted only by `app/(tabs)/record/backdate/[type].tsx`, wrapping whichever
 * live screen component that route renders for the requested type. Owns the
 * one piece of state backdating adds: the date the event actually happened.
 */
export function BackdateProvider({ children }: { children: React.ReactNode }) {
  const [eventDate, setEventDate] = useState(todayISO());
  const value = useMemo<BackdateContextValue>(
    () => ({ isBackdating: true, eventDate, setEventDate }),
    [eventDate],
  );
  return <BackdateContext.Provider value={value}>{children}</BackdateContext.Provider>;
}
