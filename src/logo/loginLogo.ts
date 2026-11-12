import { useCallback, useEffect, useReducer } from "react";
import { create } from "zustand";

import { LOGO_MOTION } from "@/src/art/paths";

/**
 * The login logo, as SCP's: it rests as the Upande mark; when the login screen appears it plays
 * the Livestock scene in (a short pause, then 1.5 s eased in and out), her tail swings for
 * PREVIEW_ROUNDS rounds, and the scene eases back out to the Upande mark, where it rests. A tap
 * on the logo plays the preview again. After a successful login, a scene still showing is played
 * out to the Upande mark first, and only then does the app move on; resting on the mark, the app
 * moves on at once. With reduce-motion it is the Upande mark throughout.
 *
 *   idle ─appear─▶ playing ─entered─▶ cow ─previewDone─▶ leaving ─returned─▶ rest ─replay─▶ playing
 *   playing / cow / leaving ─loggedIn─▶ returning ─returned─▶ upande ─settled─▶ navigate
 *   idle / rest ─loggedIn─▶ navigate
 */
export type LogoPhase = "idle" | "playing" | "cow" | "leaving" | "rest" | "returning" | "upande" | "navigate";
export type LogoEvent = "appear" | "entered" | "previewDone" | "replay" | "loggedIn" | "returned" | "settled";

/** How many rounds of her tail the preview shows before it goes back to the Upande mark. */
export const PREVIEW_ROUNDS = 2;

export function nextPhase(phase: LogoPhase, event: LogoEvent, reduceMotion: boolean): LogoPhase {
  switch (event) {
    case "appear":
      return phase === "idle" && !reduceMotion ? "playing" : phase;
    case "replay":
      return (phase === "rest" || phase === "idle") && !reduceMotion ? "playing" : phase;
    case "entered":
      return phase === "playing" ? "cow" : phase;
    case "previewDone":
      return phase === "cow" ? "leaving" : phase;
    case "loggedIn":
      if (phase === "playing" || phase === "cow" || phase === "leaving") return reduceMotion ? "navigate" : "returning";
      if (phase === "idle" || phase === "rest" || phase === "upande") return "navigate";
      return phase;
    case "returned":
      if (phase === "leaving") return "rest";
      return phase === "returning" ? "upande" : phase;
    case "settled":
      return phase === "upande" ? "navigate" : phase;
  }
  return phase;
}

/** What the logo draws in each phase (LivestockLogo's `scene`). */
export function sceneOf(phase: LogoPhase): "upande" | "in" | "cow" | "out" {
  if (phase === "playing") return "in";
  if (phase === "cow") return "cow";
  if (phase === "leaving" || phase === "returning") return "out";
  return "upande";
}

/**
 * Holds the app on the login screen after a login, until the logo has played out (AuthGate waits
 * while `holding`). Released when the logo reaches `navigate`, on a failed login, when the login
 * screen goes, or by `HOLD_MAX_MS` at the latest, so a stuck animation can never keep anyone out.
 */
// Covers the slower phone exit (PHONE_OUT_MS 1500 ms) with room to spare.
export const HOLD_MAX_MS = 3500;
export const useLoginExit = create<{
  holding: boolean;
  /** A login just went through: the next screen morphs in (MorphIn takes it once). */
  arriving: boolean;
  hold: () => void;
  release: (arrived?: boolean) => void;
  takeArrival: () => boolean;
}>((set, get) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return {
    holding: false,
    arriving: false,
    hold: () => {
      clear();
      timer = setTimeout(() => {
        timer = null;
        set({ holding: false, arriving: true });
      }, HOLD_MAX_MS);
      set({ holding: true });
    },
    // `arrived` true: the login went through; false: it failed. Left out (the
    // login screen going away), the arrival is left as it is.
    release: (arrived) => {
      clear();
      set(arrived === undefined ? { holding: false } : { holding: false, arriving: arrived });
    },
    takeArrival: () => {
      if (!get().arriving) return false;
      set({ arriving: false });
      return true;
    },
  };
});

/** The login screen's logo phase; `navigate` releases the hold so AuthGate moves on. */
export function useLoginLogo(reduceMotion: boolean) {
  const [phase, dispatch] = useReducer(
    (p: LogoPhase, e: LogoEvent) => nextPhase(p, e, reduceMotion),
    "idle" as LogoPhase,
  );
  useEffect(() => {
    dispatch("appear");
  }, []);
  // The preview: after PREVIEW_ROUNDS rounds of her tail the scene goes back to the mark.
  useEffect(() => {
    if (phase !== "cow") return undefined;
    const id = setTimeout(() => dispatch("previewDone"), PREVIEW_ROUNDS * LOGO_MOTION.cycleMs);
    return () => clearTimeout(id);
  }, [phase]);
  useEffect(() => {
    if (phase === "upande") dispatch("settled");
    if (phase === "navigate") useLoginExit.getState().release(true);
  }, [phase]);
  useEffect(() => () => useLoginExit.getState().release(), []);
  const send = useCallback((e: LogoEvent) => dispatch(e), []);
  return { phase, send };
}
