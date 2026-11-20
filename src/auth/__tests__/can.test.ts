/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import { RECORD_SECTIONS } from "../../recordSections.ts";
import { mapSession, allowedChoices, defaultChoice, segments } from "../../feed/feedSessions.ts";
import { actionsFor, canAmend, canMix, mapCapabilities, routeAllowed, sectionsFor, type Capabilities } from "../can.ts";

const caps = (o: { read?: string[]; create?: string[]; stock?: boolean }): Capabilities => {
  const m = (n: string[] = []) => Object.fromEntries(n.map((x) => [x, true]));
  return {
    read: m(o.read), create: m(o.create), write: {}, stock: !!o.stock, post_draft: false, override_feed: false,
    insure: false, accounts: false, appreciate: false, cull_vet: false, cull_manager: false, quality: false, operator: false,
  };
};
const EVENTS = ["Livestock Event"];
const ROLES: Record<string, Capabilities> = {
  manager: caps({ read: ["Herds", "Animal", "Milk Recording"], stock: true,
    create: [...EVENTS, "Livestock Health Case", "Livestock Diagnosis", "Livestock Weight Record", "Milk Recording", "Livestock Feed Actual"] }),
  milker: caps({ read: ["Herds", "Animal", "Milk Recording"], create: ["Milk Recording"] }),
  attendant: caps({ read: ["Herds", "Animal", "Milk Recording"], create: [...EVENTS, "Livestock Weight Record"] }),
  vet: caps({ read: ["Herds", "Animal"], create: [...EVENTS, "Livestock Health Case", "Livestock Diagnosis"] }),
  stores: caps({ read: ["Herds", "Animal"], stock: true, create: ["Livestock Feed Actual"] }),
};
const labels = (c: Capabilities | null) => sectionsFor(RECORD_SECTIONS, c).flatMap((s) => s.items.map((i) => i.href.split("/").pop()));

test("no map hides nothing", () => {
  assert.equal(sectionsFor(RECORD_SECTIONS, null).length, RECORD_SECTIONS.length);
  assert.equal(routeAllowed("treatment", null), true);
  assert.equal(canMix(null), true);
  assert.equal(mapCapabilities(undefined), null);
  assert.equal(mapCapabilities("x"), null);
});

test("a manager is offered every record screen", () => {
  assert.deepEqual(labels(ROLES.manager), labels(null));
});

test("a milker records milk only: no Treatment, Check up, weight, feeding or movement", () => {
  const l = labels(ROLES.milker);
  assert.ok(l.includes("milk") && l.includes("feed-report") && l.includes("stock"));
  for (const gone of ["treatment", "diagnosis", "weight", "movement", "animal-feed", "feed-day", "service"]) assert.ok(!l.includes(gone), gone);
});

test("an attendant records events and weights, not milk, treatment or feeding", () => {
  const l = labels(ROLES.attendant);
  for (const kept of ["movement", "weight", "heat", "calving"]) assert.ok(l.includes(kept), kept);
  for (const gone of ["milk", "treatment", "diagnosis", "animal-feed", "feed-day"]) assert.ok(!l.includes(gone), gone);
});

test("a vet treats and checks up, but does not weigh, milk or feed", () => {
  const l = labels(ROLES.vet);
  assert.ok(l.includes("treatment") && l.includes("diagnosis"));
  for (const gone of ["weight", "milk", "animal-feed", "feed-day"]) assert.ok(!l.includes(gone), gone);
});

test("stores may mix and amend feeding; a milker may do neither", () => {
  assert.ok(canMix(ROLES.stores) && canAmend(ROLES.stores));
  assert.ok(!canMix(ROLES.milker) && !canAmend(ROLES.milker));
  assert.ok(canAmend(ROLES.manager) && canMix(ROLES.manager));
});

test("animal quick actions follow the same rights", () => {
  const acts = [{ route: "diagnosis" }, { route: "treatment" }, { route: "weight" }, { route: "movement" }, { route: "vaccination" }];
  assert.deepEqual(actionsFor(acts, ROLES.milker), []);
  assert.deepEqual(actionsFor(acts, ROLES.attendant).map((a) => a.route), ["weight", "movement", "vaccination"]);
  assert.equal(actionsFor(acts, ROLES.manager).length, 5);
});

test("override choices: a non-manager is offered only the choices the server accepts", () => {
  const server = (state: string, sessions: any[] = [], extra: any = {}) => ({
    state, fed_fraction: state === "not_fed" ? 0 : state === "half_fed" ? 0.5 : 1, sessions, ...extra,
  });
  const half1 = { feed_session: "Half-1", session_fraction: 0.5, fed_kg: 20, components: [] };
  const fully = mapSession(server("fully_fed", [{ ...half1, feed_session: "Full", session_fraction: 1 }], { can_override: false }));
  assert.deepEqual(allowedChoices(fully), []);
  assert.deepEqual(segments(fully), []);
  const half = mapSession(server("half_fed", [half1], { can_override: false }));
  assert.deepEqual(allowedChoices(half), ["Half"]);
  assert.equal(defaultChoice(half), "Half");
  const fresh = mapSession(server("not_fed", [], { can_override: false }));
  assert.deepEqual(allowedChoices(fresh), ["Full", "Half"]);
  const boss = mapSession(server("fully_fed", [{ ...half1, feed_session: "Full", session_fraction: 1 }], { can_override: true }));
  assert.deepEqual(allowedChoices(boss), ["Full", "Half"]);
});
