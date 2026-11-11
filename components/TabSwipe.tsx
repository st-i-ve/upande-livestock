import React, { useMemo, useRef } from "react";
import { PanResponder, StyleSheet, TextInput, View } from "react-native";

/** How far a finger must travel sideways before the swipe takes the touch. */
const CLAIM_DX = 22;
/** Sideways must beat up-and-down by this much, so a scroll of a list never turns into a swipe. */
const DOMINANCE = 2;
/** Let go past this distance — or past half of it at a flick — and the tab changes. */
const COMMIT_DX = 70;
const FLICK_VX = 0.45;

type TabRoute = { key: string; name: string; state?: { index?: number } };
type TabNav = {
  getState: () => { routes: TabRoute[] };
  emit: (e: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
  navigate: (name: string) => void;
};

/** Is this tab route hidden from the bar (e.g. Record for a user without an Employee)? */
const isHidden = (name: string, hidden: readonly string[]) =>
  hidden.some((h) => name === h || name.startsWith(`${h}/`));

/**
 * The tab a swipe lands on: `dir` 1 for the one to the right (finger moved
 * left), -1 for the one to the left. Hidden tabs are skipped; at either end
 * there is nowhere to go.
 */
export function adjacentTab<R extends { name: string }>(
  routes: readonly R[],
  current: string,
  dir: 1 | -1,
  hidden: readonly string[] = [],
): R | undefined {
  const visible = routes.filter((r) => r.name === current || !isHidden(r.name, hidden));
  const i = visible.findIndex((r) => r.name === current);
  if (i < 0) return undefined;
  return visible[i + dir];
}

/** A tab sits on its root screen while nothing has been pushed onto its stack. */
export const atTabRoot = (route: { state?: { index?: number } }) => (route.state?.index ?? 0) === 0;

/**
 * Wraps one tab's screen (via the navigator's `screenLayout`) so a sideways
 * swipe moves to the neighbouring visible tab, as a tap on its icon would.
 *
 * Only on the tab's root screen: once an animal's page or a record form is
 * pushed, the screen is left alone. The swipe is a plain responder that
 * claims a move only on the way up (never in the capture phase), so anything
 * inside that scrolls sideways — horizontal ScrollViews, sliders, chip rows —
 * takes the touch natively first and cancels it here; and while a text field
 * is focused (the kg and % inputs) nothing is claimed at all.
 */
export function TabSwipe({
  route,
  navigation,
  hidden,
  children,
}: {
  route: TabRoute;
  navigation: TabNav;
  hidden: readonly string[];
  children: React.ReactNode;
}) {
  const live = useRef({ route, navigation, hidden });
  live.current = { route, navigation, hidden };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => {
          const { route: r } = live.current;
          if (!atTabRoot(r)) return false;
          if (TextInput.State.currentlyFocusedInput()) return false;
          return Math.abs(g.dx) > CLAIM_DX && Math.abs(g.dx) > DOMINANCE * Math.abs(g.dy);
        },
        onPanResponderTerminationRequest: () => true,
        onPanResponderRelease: (_e, g) => {
          const far = Math.abs(g.dx) > COMMIT_DX;
          const flick = Math.abs(g.dx) > COMMIT_DX / 2 && Math.abs(g.vx) > FLICK_VX && Math.sign(g.vx) === Math.sign(g.dx);
          if (!far && !flick) return;
          const { route: r, navigation: nav, hidden: h } = live.current;
          const target = adjacentTab(nav.getState().routes, r.name, g.dx < 0 ? 1 : -1, h);
          if (!target) return;
          // Same path as a tap on the icon, so the Record tab's listener still
          // brings its menu back to the front.
          const ev = nav.emit({ type: "tabPress", target: target.key, canPreventDefault: true });
          if (!ev.defaultPrevented) nav.navigate(target.name);
        },
      }),
    [],
  );

  return (
    <View style={s.fill} {...responder.panHandlers}>
      {children}
    </View>
  );
}

const s = StyleSheet.create({ fill: { flex: 1 } });
