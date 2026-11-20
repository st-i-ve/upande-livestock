/**
 * A herd's feed day mixed in one session (Full day) or two (Half day, session 1
 * of 2 and 2 of 2). Pure helpers shared by the Feeding day sheet and the System
 * feeding screen, tested without a phone. The server owns the state machine;
 * this only mirrors it so the phone can offer the right choice and ask before
 * an over-feed (the write is queued, so the refusal would otherwise come late).
 */

export type FeedChoice = "Full" | "Half";
export type DayState = "not_fed" | "half_fed" | "fully_fed";

export type SessionComponent = { itemCode: string; itemName: string; uom: string; plannedKg: number; fedKg: number };

export type FeedSessionRow = {
  feedSession: "Full" | "Half-1" | "Half-2" | string;
  label: string;
  fraction: number;
  source: string;
  status: string;
  plannedKg: number;
  fedKg: number;
  amended: boolean;
  fedOn: string;
  overridden: boolean;
  components: SessionComponent[];
};

export type DaySession = {
  state: DayState;
  label: string;
  fedFraction: number;
  remainingFraction: number;
  choices: string[];
  nextSession: string | null;
  secondDue: boolean;
  canOverride: boolean;
  sessions: FeedSessionRow[];
};

const n = (v: unknown): number => Number(v ?? 0) || 0;

export const NOT_FED: DaySession = {
  state: "not_fed",
  label: "Not fed",
  fedFraction: 0,
  remainingFraction: 1,
  choices: ["Full", "Half-1"],
  nextSession: null,
  secondDue: false,
  canOverride: false,
  sessions: [],
};

export const mapSession = (m: any): DaySession => {
  if (!m || typeof m !== "object") return NOT_FED;
  const state: DayState = m.state === "half_fed" || m.state === "fully_fed" ? m.state : "not_fed";
  return {
    state,
    label: m.label ?? STATE_LABEL[state],
    fedFraction: n(m.fed_fraction),
    remainingFraction: n(m.remaining_fraction),
    choices: m.choices ?? [],
    nextSession: m.next_session ?? null,
    secondDue: !!m.second_due,
    canOverride: !!m.can_override,
    sessions: (m.sessions ?? []).map((s: any) => ({
      feedSession: s.feed_session,
      label: s.label ?? SESSION_LABEL[s.feed_session as string] ?? s.feed_session,
      fraction: n(s.session_fraction),
      source: s.source ?? "",
      status: s.status ?? "",
      plannedKg: n(s.planned_kg),
      fedKg: n(s.fed_kg),
      amended: !!s.amended,
      fedOn: s.fed_on ?? "",
      overridden: !!s.overridden,
      components: (s.components ?? []).map((c: any) => ({
        itemCode: c.item_code,
        itemName: c.item_name ?? c.item_code,
        uom: c.uom ?? "kg",
        plannedKg: n(c.planned_kg),
        fedKg: n(c.fed_kg),
      })),
    })),
  };
};

export const STATE_LABEL: Record<DayState, string> = {
  not_fed: "Not fed",
  half_fed: "Half fed (1 of 2)",
  fully_fed: "Fully fed",
};

export const SESSION_LABEL: Record<string, string> = {
  Full: "Full day",
  "Half-1": "Half day, session 1 of 2",
  "Half-2": "Half day, session 2 of 2",
};

/** Which half "Half" will be: session 2 once a first half stands, else session 1. */
export const nextHalf = (s: Pick<DaySession, "sessions">): "Half-1" | "Half-2" =>
  s.sessions.some((r) => r.feedSession === "Half-1") && !s.sessions.some((r) => r.feedSession === "Half-2")
    ? "Half-2"
    : "Half-1";

export const halfLabel = (s: Pick<DaySession, "sessions">): string => SESSION_LABEL[nextHalf(s)];

/** The two segments of the control. */
export const segments = (s: DaySession): { value: FeedChoice; label: string }[] => [
  { value: "Full", label: "Full day" },
  { value: "Half", label: s.state === "half_fed" ? "Half day (2 of 2)" : "Half day (1 of 2)" },
];

/** Which segment to preselect: the second half when one is owed, else a full day. */
export const defaultChoice = (s: DaySession): FeedChoice => (s.state === "half_fed" ? "Half" : "Full");

export type Guard =
  | { kind: "ok" }
  | { kind: "confirm"; message: string; override: boolean }
  | { kind: "refuse"; message: string };

/** Would this choice feed more than a day (or repeat a half)? Mirrors the server's guard.
 *  A manager (`canOverride`) is asked to confirm and the write is sent with `override`;
 *  anyone else is told it needs a manager rather than queueing a write the server refuses. */
export const guardChoice = (s: DaySession, choice: FeedChoice): Guard => {
  const share = choice === "Full" ? 1 : 0.5;
  const taken = new Set(s.sessions.map((r) => r.feedSession));
  const wanted = choice === "Full" ? "Full" : nextHalf(s);
  const over = s.fedFraction + share > 1 + 1e-6;
  if (!over && !taken.has(wanted)) return { kind: "ok" };
  const what = over
    ? choice === "Full"
      ? "This herd was already fed part of the day. A full day on top is more than a day's feed."
      : "This herd has already had its full day. Another session is more than a day's feed."
    : "This session was already fed.";
  if (s.canOverride) return { kind: "confirm", message: `${what} Feed it anyway?`, override: true };
  return { kind: "refuse", message: `${what} Only a Livestock Manager can override this.` };
};

const kg = (v: number) => `${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`;

/** "Half day, session 1 of 2: 20 kg Calves Meal (amended)": the session's biggest line, as history. */
export const sessionLine = (r: FeedSessionRow): string => {
  const top = [...r.components].sort((a, b) => b.fedKg - a.fedKg)[0];
  const what = top ? `${kg(top.fedKg)} ${top.itemName}` : kg(r.fedKg);
  const more = r.components.length > 1 ? ` + ${r.components.length - 1} more` : "";
  return `${r.label}: ${what}${more}${r.amended ? " (amended)" : ""}${r.status === "Waiting for stock" ? ", waiting for stock" : ""}`;
};

/** The queued item's title, e.g. "Feed · Calves · Half day". */
export const queuedTitle = (base: string, choice: FeedChoice | undefined): string =>
  choice ? `${base} · ${choice === "Half" ? "Half day" : "Full day"}` : base;

/** What the queued item sends: `feed_session` always, `override` only when set. */
export const sessionArgs = (choice: FeedChoice | undefined, override?: boolean): Record<string, any> => ({
  ...(choice ? { feed_session: choice } : {}),
  ...(override ? { override: 1 } : {}),
});
