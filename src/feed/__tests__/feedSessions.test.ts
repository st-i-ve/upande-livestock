/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  defaultChoice, guardChoice, halfLabel, mapSession, queuedTitle, segments, sessionArgs, sessionLine,
} from "../feedSessions.ts";

const server = (state: string, sessions: any[] = [], extra: any = {}) => ({
  state, fed_fraction: state === "not_fed" ? 0 : state === "half_fed" ? 0.5 : 1, sessions, ...extra,
});
const half1 = { feed_session: "Half-1", session_fraction: 0.5, fed_kg: 20, amended: true,
  components: [{ item_code: "CM", item_name: "Calves Meal", planned_kg: 15, fed_kg: 20 }, { item_code: "H", fed_kg: 2 }] };
const half2 = { ...half1, feed_session: "Half-2", amended: false };

test("an empty or missing session reads as not fed", () => {
  assert.equal(mapSession(undefined).state, "not_fed");
  assert.equal(mapSession(server("not_fed")).label, "Not fed");
});

test("half fed offers the second half and labels it", () => {
  const s = mapSession(server("half_fed", [half1], { label: "Half fed (1 of 2)", second_due: true }));
  assert.equal(s.secondDue, true);
  assert.equal(halfLabel(s), "Half day, session 2 of 2");
  assert.equal(segments(s)[1].label, "Half day (2 of 2)");
  assert.equal(defaultChoice(s), "Half");
  assert.equal(halfLabel(mapSession(server("not_fed"))), "Half day, session 1 of 2");
  assert.equal(defaultChoice(mapSession(server("not_fed"))), "Full");
});

test("the guard mirrors the server: fine on a fresh day, a second half, and refused beyond a day", () => {
  assert.equal(guardChoice(mapSession(server("not_fed")), "Full").kind, "ok");
  assert.equal(guardChoice(mapSession(server("not_fed")), "Half").kind, "ok");
  assert.equal(guardChoice(mapSession(server("half_fed", [half1])), "Half").kind, "ok");
  assert.equal(guardChoice(mapSession(server("half_fed", [half1])), "Full").kind, "refuse");
  assert.equal(guardChoice(mapSession(server("fully_fed", [half1, half2])), "Half").kind, "refuse");
});

test("only a manager is offered the override", () => {
  const s = mapSession(server("half_fed", [half1], { can_override: true }));
  const g = guardChoice(s, "Full");
  assert.equal(g.kind, "confirm");
  assert.equal(g.kind === "confirm" && g.override, true);
});

test("history line names the session, the biggest line and whether it was amended", () => {
  const s = mapSession(server("half_fed", [half1]));
  assert.equal(sessionLine(s.sessions[0]), "Half day, session 1 of 2: 20 kg Calves Meal + 1 more (amended)");
});

test("queued items carry the session", () => {
  assert.equal(queuedTitle("Feed · Calves", "Half"), "Feed · Calves · Half day");
  assert.equal(queuedTitle("Feed · Calves", undefined), "Feed · Calves");
  assert.deepEqual(sessionArgs("Half"), { feed_session: "Half" });
  assert.deepEqual(sessionArgs("Full", true), { feed_session: "Full", override: 1 });
});
