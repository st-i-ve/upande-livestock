import { useCallback, useEffect, useReducer } from "react";
import { create } from "zustand";

/**
 * The login logo, as the desk tile behaves on hover: it rests as the Upande mark, plays the
 * Livestock scene in when the login screen appears and settles on the cow (her tail swinging);
 * after a successful login it plays back out to the Upande mark, and only then does the app move
 * on to the next screen. With reduce-motion it is the Upande mark throughout and a login moves on
 * at once.
 *
 *   idle ──appear──▶ playing ──entered──▶ cow ──loggedIn──▶ returning ──returned──▶ upande ──▶ navigate
 *
 * A login that lands while the scene is still coming in turns it round from where it is.
 */
export type LogoPhase = "idle" | "playing" | "cow" | "returning" | "upande" | "navigate";
export type LogoEvent = "appear" | "entered" | "loggedIn" | "returned" | "settled";

export function nextPhase(phase: LogoPhase, event: LogoEvent, reduceMotion: boolean): LogoPhase {
  switch (event) {
    case "appear":
      return phase === "idle" && !reduceMotion ? "playing" : phase;
    case "entered":
      return phase === "playing" ? "cow" : phase;
    case "loggedIn":
      if (phase === "playing" || phase === "cow") return reduceMotion ? "navigate" : "returning";
      if (phase === "idle" || phase === "upande") return "navigate";
      return phase;
    case "returned":
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
  if (phase === "returning") return "out";
  return "upande";
}

/**
 * Holds the app on the login screen after a login, until the logo has played out (AuthGate waits
 * while `holding`). Released when the logo reaches `navigate`, on a failed login, when the login
 * screen goes, or by `HOLD_MAX_MS` at the latest, so a stuck animation can never keep anyone out.
 */
export const HOLD_MAX_MS = 2500;
export const useLoginExit = create<{ holding: boolean; hold: () => void; release: () => void }>((set) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return {
    holding: false,
    hold: () => {
      clear();
      timer = setTimeout(() => {
        timer = null;
        set({ holding: false });
      }, HOLD_MAX_MS);
      set({ holding: true });
    },
    release: () => {
      clear();
      set({ holding: false });
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
  useEffect(() => {
    if (phase === "upande") dispatch("settled");
    if (phase === "navigate") useLoginExit.getState().release();
  }, [phase]);
  useEffect(() => () => useLoginExit.getState().release(), []);
  const send = useCallback((e: LogoEvent) => dispatch(e), []);
  return { phase, send };
}
