#!/usr/bin/env node
/**
 * Smoke test for the Mutara beef app: every network call it makes, against a real
 * backend (`upande_livestock`, branch mutara-beef), as the herdsman's phone login.
 *
 *   LIVESTOCK_URL=https://mutara.132.145.18.63.nip.io \
 *   LIVESTOCK_USER=saitoti@mutaraorchards.com LIVESTOCK_PASSWORD=... \
 *   [WRITE=1] [SMOKE_CLEANUP=0] node scripts/api-smoke.mjs
 *
 * Logs in the way the app does (POST /api/method/login, session cookie), replays
 * the app's reads with their exact shapes (design section 12), and checks the keys
 * the app reads. With WRITE=1 it also records what the phone records, against
 * animals it finds in the seed (override with SMOKE_COW / SMOKE_COW2 / SMOKE_COW3 /
 * SMOKE_HEIFER; the calves come from `eligibility.separation_due`):
 *
 *   weight session (each, and a pen on the platform) ... natural service with the
 *   inferred sire (or the candidate chooser) ... pregnancy diagnosis with a
 *   perceived conception date and no service on file ... calving with no service
 *   on file ... movement calf -> feedlot ... selection movement calf -> a breeding
 *   herd (refused without the note, accepted with it, stream and note saved) ...
 *   kinship preview and a warned move (dam-son).
 *
 * Everything it creates is listed (the last line, CREATED [...]) and then removed
 * (cancel + delete through the API); a document the API will not remove is
 * reported, never ignored. SMOKE_CLEANUP=0 keeps them.
 *
 * THE TEST USER (a System User on a DEVELOPMENT site; nothing else makes this green):
 *   an Employee with user_id = that user, the herdsman and manager roles.
 *   Mutara's is saitoti@mutaraorchards.com; its password lives only in the site
 *   config / test env, never in the repo.
 * SMOKE_NONEMP_USER / SMOKE_NONEMP_PASSWORD: a user with NO Employee. Its reads must
 *   still work and every recording endpoint must refuse with code not_employee.
 * Point it at a development site only.
 */
import { Buffer } from "node:buffer";

const URL_ = process.env.LIVESTOCK_URL;
const USER = process.env.LIVESTOCK_USER;
const PASS = process.env.LIVESTOCK_PASSWORD;
const WRITE = process.env.WRITE === "1";
const CLEANUP = process.env.SMOKE_CLEANUP !== "0";
const NONEMP_USER = process.env.SMOKE_NONEMP_USER;
const NONEMP_PASS = process.env.SMOKE_NONEMP_PASSWORD;
if (!URL_ || !USER || !PASS) {
  console.error("Set LIVESTOCK_URL, LIVESTOCK_USER and LIVESTOCK_PASSWORD.");
  process.exit(2);
}

const M = "/api/method/upande_livestock.serverscripts";
let cookie = "";
const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const created = []; // {doctype, name}
const rows = [];
const ctx = {};

async function http(method, path, { params, body, form } = {}) {
  const url = new URL(URL_ + path);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
  const headers = { Accept: "application/json" };
  if (cookie) headers.Cookie = cookie;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(url, { method, headers, body: payload });
  const sc = res.headers.getSetCookie?.() ?? [];
  if (sc.length) cookie = sc.map((c) => c.split(";")[0]).join("; ");
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
}
const get = (p, params) => http("GET", p, { params });
const post = (p, body) => http("POST", p, { body });

/** A server reply is good when HTTP 200 and no `{error}` in the message. */
const msgOf = (r) => {
  if (r.status !== 200) {
    const e = r.data?.exception || r.data?._server_messages || JSON.stringify(r.data)?.slice(0, 200);
    throw new Error(`HTTP ${r.status} ${String(e).slice(0, 260)}`);
  }
  const m = r.data?.message ?? r.data?.data ?? r.data;
  if (m && m.error) throw new Error(String(m.error).slice(0, 300));
  return m;
};
const need = (obj, keys, label) => {
  const miss = keys.filter((k) => obj == null || !(k in obj));
  if (miss.length) throw new Error(`${label} missing keys: ${miss.join(", ")}`);
};
const check = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

async function step(group, name, fn) {
  try {
    const note = await fn();
    rows.push({ group, name, ok: true, note: note ? String(note).slice(0, 110) : "" });
  } catch (e) {
    rows.push({ group, name, ok: false, note: String(e.message || e).slice(0, 400) });
  }
}
const track = (doctype, name) => name && !created.some((c) => c.doctype === doctype && c.name === name) && created.push({ doctype, name });

async function login(user, pass) {
  const body = new URLSearchParams({ usr: user, pwd: pass });
  const res = await fetch(URL_ + "/api/method/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const j = await res.json();
  if (res.status !== 200 || !cookie) throw new Error(`login ${res.status} ${JSON.stringify(j)}`);
  return j.full_name;
}

// ---------------------------------------------------------------------------
await step("auth", "POST /api/method/login", () => login(USER, PASS));
await step("auth", "frappe.auth.get_logged_user", async () => {
  const m = msgOf(await get("/api/method/frappe.auth.get_logged_user"));
  check(m === USER, `logged in as ${m}`);
});

// ---------------------------------------------------------------------------
// READS: the app's exact calls
await step("read", "settings.posting_day (today, backdating, Employee, roles)", async () => {
  const m = msgOf(await get(`${M}.settings.posting_day.posting_day`));
  need(m, ["today", "backdating_open", "is_employee", "employee", "employee_name", "roles"], "posting_day");
  check(Array.isArray(m.roles) && m.roles.length > 0, `roles is ${JSON.stringify(m.roles)}`);
  check(m.is_employee && m.employee, "no Employee linked to this user: every recording call will be refused");
  ctx.employee = m.employee;
  ctx.roles = m.roles;
  return `${m.employee_name} (${m.employee}), roles ${m.roles.join(", ")}, backdating ${m.backdating_open ? "OPEN" : "closed"}`;
});
await step("read", "mobile.get_bootstrap_bundle: herds with class, breeding flag, counts", async () => {
  const m = msgOf(await post(`${M}.mobile.get_bootstrap_bundle.get_bootstrap_bundle`, {}));
  need(m.herds?.[0], ["name", "label", "heads", "category", "has_bom", "herd_class", "is_breeding", "females", "bulls", "fed_heads"], "herd");
  ctx.herds = m.herds;
  ctx.breedingHerds = m.herds.filter((h) => h.is_breeding).map((h) => h.name);
  check(ctx.breedingHerds.length > 0, "no herd is class Breeding");
  for (const h of m.herds) if (h.is_breeding) check(h.herd_class === "Breeding", `${h.name}: is_breeding but class ${h.herd_class}`);
  return `${m.herds.length} herds, breeding: ${ctx.breedingHerds.join(", ")}`;
});
await step("read", "mobile.get_bootstrap_bundle: settings block", async () => {
  const m = msgOf(await post(`${M}.mobile.get_bootstrap_bundle.get_bootstrap_bundle`, {}));
  need(m.settings, ["calf_separation_age_days", "default_service_type", "breeding_bull_min_age_months", "conception_window_days", "kinship_check"], "settings");
  check(["Natural", "A.I."].includes(m.settings.default_service_type), `default_service_type ${m.settings.default_service_type}`);
  ctx.beef = m.settings;
  return `separation ${m.settings.calf_separation_age_days} d, service default ${m.settings.default_service_type}`;
});
const SYNC_FIELDS = ["name", "tag", "animal_name", "sex", "breed", "dob", "herd", "status", "stage", "repro_status", "image", "dam", "sire", "parity", "last_weight_kg", "modified"];
await step("read", "mobile.animals_since full (offline store at login)", async () => {
  const m = msgOf(await get(`${M}.mobile.animals_since.animals_since`));
  need(m, ["server_time", "animals", "removed"], "animals_since");
  check(!m.removed.length, "a full sync must not name removed animals");
  need(m.animals[0], SYNC_FIELDS, "animal row");
  ctx.animals = m.animals;
  ctx.animal = m.animals[0].name;
  ctx.syncTime = m.server_time;
  return `${m.animals.length} animals`;
});
await step("read", "mobile.animals_since delta (foreground, pull-to-refresh)", async () => {
  const m = msgOf(await get(`${M}.mobile.animals_since.animals_since`, { since: ctx.syncTime }));
  need(m, ["server_time", "animals", "removed"], "delta");
  check(m.animals.length <= ctx.animals.length, "a delta returned more than the full set");
  return `${m.animals.length} changed`;
});
await step("read", "GET Animal/<name> (animal page: stream, breeding note, sire)", async () => {
  const m = msgOf(await get(`/api/resource/Animal/${encodeURIComponent(ctx.animal)}`));
  need(m, ["name", "sex", "status"], "animal doc");
  // These are read by the app when set; on a seeded bull they are there.
  const bull = (ctx.animals || []).find((a) => a.sex?.[0] === "M" && a.stage !== "retired");
  if (bull) {
    const b = msgOf(await get(`/api/resource/Animal/${encodeURIComponent(bull.name)}`));
    check("stream" in b || b.stream === undefined, "stream");
  }
});
await step("read", "animals.animal_profile (weight / gain block)", async () => {
  const m = msgOf(await post(`${M}.animals.animal_profile.animal_profile`, { payload: { animal: ctx.animal } }));
  need(m, ["id", "stage", "gain"], "profile");
  need(m.gain, ["trend", "lifetime_adg", "herd_adg", "target_adg_kg"], "gain");
});
await step("read", "animals.animal_standing", async () => {
  const m = msgOf(await post(`${M}.animals.animal_standing.animal_standing`, { payload: { animal: ctx.animal } }));
  need(m, ["asOf", "herd", "group", "metrics"], "standing");
});
await step("read", "GET Livestock Event list with remarks (animal timeline, note history)", async () => {
  const f = ["name", "animal", "event_type", "event_date", "current_herd", "new_herd", "diagnosis_result", "remarks", "docstatus", "custom_is_backdated", "custom_feed_mode"];
  const m = msgOf(await get("/api/resource/Livestock Event", { fields: f, filters: [["docstatus", "=", 1]], order_by: "event_date desc", limit_page_length: 20 }));
  if (m.length) need(m[0], f, "event row");
  return `${m.length} events`;
});
await step("read", "GET Livestock Settings doc (calf herds, separation age)", async () => {
  const m = msgOf(await get("/api/resource/Livestock Settings/Livestock Settings"));
  need(m, ["female_calf_herd", "male_calf_herd", "growth_ladder", "calf_separation_age_days", "default_service_type"], "settings");
});
await step("read", "movement.eligibility (breeding_herds, separation_due)", async () => {
  const m = msgOf(await post(`${M}.movement.eligibility.eligibility`, {}));
  need(m, ["breeding_herds", "separation_due", "service_herds", "service_wait_days", "growth_ladder", "next_herd", "calf_herds", "diagnosable", "heifer_herds"], "eligibility");
  check(!("milking_herds" in m), "milking_herds is gone on Mutara");
  for (const h of ctx.breedingHerds) check(m.breeding_herds.includes(h), `${h} missing from breeding_herds`);
  for (const h of m.breeding_herds) check(m.service_herds.includes(h), `${h} (Breeding) is not a service herd`);
  if (m.separation_due[0]) {
    need(m.separation_due[0], ["animal", "label", "sex", "herd", "age_days", "over_days", "weight_kg", "options"], "separation_due row");
    for (const d of m.separation_due) check(d.age_days >= ctx.beef.calf_separation_age_days, `${d.animal} is ${d.age_days} d, under the separation age`);
  }
  ctx.elig = m;
  return `${m.breeding_herds.length} breeding herds, ${m.separation_due.length} calves due, ${m.diagnosable.length} diagnosable`;
});
await step("read", "separation_due offers the right streams (heifer / feedlot + breeding)", async () => {
  const due = ctx.elig.separation_due;
  if (!due.length) return "none due";
  for (const d of due) {
    const streams = d.options.map((o) => o.stream);
    if (d.sex === "Female") check(streams.join() === "Heifer", `${d.animal} (heifer): ${streams}`);
    else {
      check(streams.includes("Feedlot") && streams.includes("Breeding"), `${d.animal} (bull calf): ${streams}`);
      const b = d.options.find((o) => o.stream === "Breeding");
      check(Array.isArray(b.herds) && b.herds.length, `${d.animal}: Breeding option lists no herds`);
    }
  }
  return `${due.filter((d) => d.sex !== "Female").length} bull calves, ${due.filter((d) => d.sex === "Female").length} heifers`;
});
await step("read", "movement.movement_suggestions", async () => {
  const m = msgOf(await post(`${M}.movement.movement_suggestions.movement_suggestions`, {}));
  need(m, ["growth"], "suggestions");
});
await step("read", "movement.kinship_check (preview)", async () => {
  const bull = (ctx.animals || []).find((a) => a.sex?.[0] === "M" && !ctx.breedingHerds.includes(a.herd));
  const herd = ctx.breedingHerds[0];
  if (!bull) return "no non-breeding bull to preview";
  const m = msgOf(await post(`${M}.movement.kinship_check.kinship_check`, { animal: bull.name, herd }));
  need(m, ["warnings", "conflicts", "selection", "note_required", "stream"], "kinship_check");
  check(m.selection === true && m.note_required === true && m.stream === "Breeding", `a bull into ${herd} should be a selection: ${JSON.stringify({ s: m.selection, n: m.note_required, st: m.stream })}`);
  return `${bull.name} -> ${herd}: selection, note required`;
});
await step("read", "breeding.sire_candidates (preview)", async () => {
  const cow = (ctx.animals || []).find((a) => a.sex?.[0] === "F" && ctx.breedingHerds.includes(a.herd));
  const m = msgOf(await post(`${M}.breeding.sire_candidates.sire_candidates`, { animal: cow.name, conception_date: today }));
  need(m, ["sire_animal", "label", "inferred", "basis", "candidates"], "sire_candidates");
  return `${cow.name}: ${m.candidates.length} candidate(s), inferred=${m.inferred}`;
});
await step("read", "herds.herd_rations (head counts: females, bulls, calves, fed_heads)", async () => {
  const herd = ctx.herds.find((h) => h.has_bom)?.name;
  if (!herd) return "no herd has a ration";
  const m = msgOf(await post(`${M}.herds.herd_rations.herd_rations`, {}));
  const list = Array.isArray(m) ? m : m.herds || m.rows || m.rations || [];
  if (list[0]) need(list[0], ["fed_heads", "calves", "bulls", "females"], "ration row");
  return `${list.length} rows`;
});
await step("read", "weights.weight_options", async () => {
  const m = msgOf(await get(`${M}.weights.weight_options.weight_options`, { settings_only: 1 }));
  need(m, ["methods", "default_method", "weighbridge_available"], "weight_options");
  ctx.weightMethod = m.default_method;
});
await step("read", "people.vet_options", async () => {
  const m = msgOf(await post(`${M}.people.vet_options.vet_options`, { payload: {} }));
  need(m, ["vets", "mine"], "vet_options");
});
await step("read", "health.health_options", async () => {
  const m = msgOf(await post(`${M}.health.health_options.health_options`, {}));
  need(m, ["items_by_event", "diseases", "employee", "company"], "options");
  ctx.opts = m;
});
await step("read", "mobile.get_livestock_stock", async () => {
  const m = msgOf(await post(`${M}.mobile.get_livestock_stock.get_livestock_stock`, {}));
  need(m, ["as_of", "stores", "count"], "livestock stock");
  return `${m.count} items in ${m.stores.length} stores`;
});
await step("read", "mobile.get_animal_bundle", async () => {
  msgOf(await post(`${M}.mobile.get_animal_bundle.get_animal_bundle`, {}));
});
await step("read", "mobile.realtime_info", async () => {
  msgOf(await post(`${M}.mobile.realtime_info.realtime_info`, {}));
});

// ---------------------------------------------------------------------------
async function ev(type, payload) {
  const m = msgOf(await post(`${M}.mobile.record_animal_event.record_animal_event`, { payload: { type, ...payload } }));
  track("Livestock Event", m.name);
  for (const n of m.names || []) track("Livestock Event", n);
  for (const s of [m.service]) if (typeof s === "string" && m.service_created) track("Livestock Event", s);
  return m;
}
/** The raw reply, for steps that expect a refusal. */
const evRaw = async (type, payload) => (await post(`${M}.mobile.record_animal_event.record_animal_event`, { payload: { type, ...payload } })).data?.message;
const doc = async (doctype, name) => msgOf(await get(`/api/resource/${doctype}/${encodeURIComponent(name)}`));
const rowOf = async (name) => (msgOf(await get(`${M}.mobile.animals_since.animals_since`)).animals || []).find((a) => a.name === name);

// Find the animals the writes use, from the seed (or the env).
async function discover() {
  const by = (p) => (ctx.animals || []).filter(p);
  // Females in a breeding herd that can be served: open or heifer, nothing awaiting a check.
  const free = by((a) => a.sex?.[0] === "F" && ctx.breedingHerds.includes(a.herd) && ["open", "heifer"].includes(a.stage) && !ctx.elig.diagnosable.includes(a.name));
  // One who has not calved inside the minimum calving interval, for the calving step.
  const settled = [];
  for (const a of free) {
    if (settled.length >= 2) break;
    const p = msgOf(await post(`${M}.animals.animal_profile.animal_profile`, { payload: { animal: a.name } }));
    if (!p.lastCalving || (Date.now() - Date.parse(p.lastCalving)) / 86_400_000 > 300) settled.push(a);
  }
  const [dam, pdCow] = settled;
  ctx.calvingDam = process.env.SMOKE_DAM || dam?.name;
  ctx.calvingDamHerd = dam?.herd;
  const rest = free.filter((a) => a.name !== ctx.calvingDam && a.name !== pdCow?.name);
  const pick = (env, i) => process.env[env] || rest[i]?.name;
  ctx.cow = pick("SMOKE_COW", 0);
  ctx.cow2 = pick("SMOKE_COW2", 1);
  ctx.cow3 = pick("SMOKE_COW3", 2);
  ctx.cow4 = process.env.SMOKE_COW4 || pdCow?.name;
  ctx.heifer = process.env.SMOKE_HEIFER || by((a) => a.sex?.[0] === "F" && !ctx.breedingHerds.includes(a.herd) && a.stage === "heifer")[0]?.name;
  const due = ctx.elig.separation_due.filter((d) => d.sex !== "Female");
  ctx.calfFeedlot = due[0];
  ctx.calfBreeding = due[1];
  ctx.bullInBreeding = by((a) => a.sex?.[0] === "M" && ctx.breedingHerds.includes(a.herd) && a.dob && (Date.now() - Date.parse(a.dob)) / 86_400_000 > 700)[0];
}

// Cancelling an event does not roll back what it stamped on the Animal (repro status,
// last service date, stream, breeding note ...), so the run snapshots the animals it
// touches and puts those fields back after the documents are removed.
const RESTORE_FIELDS = ["repro_status", "parity", "last_calving_date", "expected_calving_date", "last_service_date", "last_weight_kg", "last_bcs", "current_herd", "stream", "breeding_note", "breeding_note_by", "breeding_note_on", "sire"];
const snapshots = new Map();
async function snapshot(names) {
  for (const n of names.filter(Boolean)) {
    if (!snapshots.has(n)) snapshots.set(n, await doc("Animal", n));
  }
}
async function restoreAnimals() {
  const out = { fixed: 0, failed: [] };
  for (const [name, before] of snapshots) {
    const now = await doc("Animal", name);
    const diff = {};
    for (const f of RESTORE_FIELDS) if ((now[f] ?? null) !== (before[f] ?? null)) diff[f] = before[f] ?? null;
    if (!Object.keys(diff).length) continue;
    const res = await http("PUT", `/api/resource/Animal/${encodeURIComponent(name)}`, { body: diff });
    if (res.status === 200) out.fixed++;
    else out.failed.push(`${name} ${Object.keys(diff).join("/")} (HTTP ${res.status})`);
  }
  return out;
}

async function writes() {
  const op = ctx.employee;
  await discover();
  await snapshot([ctx.cow, ctx.cow2, ctx.cow3, ctx.cow4, ctx.calvingDam, ctx.heifer, ctx.calfFeedlot?.animal, ctx.calfBreeding?.animal, ctx.bullInBreeding?.name]);
  const lines = [`cows ${ctx.cow}, ${ctx.cow2}, ${ctx.cow3}, ${ctx.cow4}`, `calving dam ${ctx.calvingDam}`, `heifer ${ctx.heifer}`, `calves ${ctx.calfFeedlot?.animal}, ${ctx.calfBreeding?.animal}`];
  rows.push({ group: "write", name: "animals found for the write steps", ok: !!(ctx.cow && ctx.cow4 && ctx.calvingDam && ctx.heifer), note: lines.join("; ") });

  // ---- Weight (first in the Record list) -----------------------------------
  await step("write", "weights.record_weights: each (2 good + 1 refused)", async () => {
    const bad = "ZZ-NO-SUCH-ANIMAL";
    const m = msgOf(await post(`${M}.weights.record_weights.record_weights`, {
      payload: { method: ctx.weightMethod, measured_by: op, weights: [{ animal: ctx.cow, weight_kg: 455 }, { animal: bad, weight_kg: 300 }, { animal: ctx.heifer, weight_kg: 301 }] },
    }));
    for (const r of m.recorded) track("Livestock Weight Record", r.name);
    check(m.count === 2 && m.failed.length === 1 && m.failed[0].animal === bad && m.failed[0].why, `expected 2 saved + 1 refused: ${JSON.stringify(m)}`);
    const row = await rowOf(ctx.cow);
    check(Number(row.last_weight_kg) === 455, `last_weight_kg is ${row.last_weight_kg}, not 455`);
    return `${m.count} saved, refused: ${m.failed[0].why}`;
  });
  await step("write", "weights.record_weights: a pen on the platform (total / head)", async () => {
    const m = msgOf(await post(`${M}.weights.record_weights.record_weights`, {
      payload: { method: ctx.weightMethod, measured_by: op, group: { animals: [ctx.cow2, ctx.cow3], total_weight_kg: 900 } },
    }));
    for (const r of m.recorded || []) track("Livestock Weight Record", r.name);
    check(m.count === 2, `expected 2 recorded: ${JSON.stringify(m).slice(0, 200)}`);
    const row = await rowOf(ctx.cow2);
    check(Number(row.last_weight_kg) === 450, `pen figure per head: ${row.last_weight_kg}, expected 450`);
    return `${m.count} animals at 450 kg each`;
  });
  await step("write", "Heat Detection", async () => (await ev("Heat Detection", { animal: ctx.heifer, event_date: today, operator: op, remarks: "smoke" })).name);

  // ---- Natural service, sire inferred ---------------------------------------
  await step("write", "Service: natural, perceived conception date, sire inferred or chosen", async () => {
    let m = await ev("Service", { animal: ctx.cow, event_date: today, operator: op, service_date: today, conception_date: today, remarks: "smoke" });
    need(m, ["service_type", "sire_animal", "sire_label", "sire_inferred", "sire_basis", "candidates", "conception_date"], "service reply");
    check(m.service_type === "Natural", `default service type is ${m.service_type}, not Natural`);
    check(m.warnings === undefined || Array.isArray(m.warnings), "warnings is not a list");
    ctx.service1 = m.name;
    if (m.sire_animal) {
      check(m.sire_inferred === true, "a bull was set but sire_inferred is false");
      check(m.sire_basis, "no sire_basis");
      return `${m.name}: ${m.sire_label} inferred (${m.sire_basis})`.slice(0, 110);
    }
    // Several (or no) bulls: the chooser path. The user's pick wins.
    return `${m.name}: no single bull (${m.candidates.length} candidates); ${m.sire_basis || ""}`;
  });
  await step("write", "Service: the herdsman's own pick wins, A.I. stays available", async () => {
    const cands = (await post(`${M}.breeding.sire_candidates.sire_candidates`, { animal: ctx.cow2, conception_date: today })).data?.message;
    const bull = cands?.candidates?.[0]?.animal || ctx.bullInBreeding?.name;
    check(bull, "no bull to pick");
    const m = await ev("Service", { animal: ctx.cow2, event_date: today, operator: op, service_date: today, conception_date: today, sire_animal: bull, remarks: "smoke pick" });
    check(m.sire_animal === bull, `sire_animal ${m.sire_animal}, picked ${bull}`);
    check(m.sire_inferred === false, "a picked sire must not be flagged inferred");
    ctx.service2 = m.name;
    return `${m.name}: sire ${m.sire_label}`;
  });
  await step("write", "Service: A.I. with a free-text sire", async () => {
    const m = await ev("Service", { animal: ctx.cow3, event_date: today, operator: op, service_type: "A.I.", service_date: today, sire: "SMOKE SIRE", sire_unknown: 1, remarks: "smoke ai" });
    check(m.service_type === "A.I.", `service_type ${m.service_type}`);
    return m.name;
  });

  // ---- PD with a conception date and no service on file ---------------------
  await step("write", "Pregnancy Diagnosis: no service on file is refused without a conception date", async () => {
    const r = await evRaw("Pregnancy Diagnosis", { animal: ctx.cow4, event_date: today, operator: op, diagnosis_date: today, diagnosis_result: "Confirmed" });
    check(r?.error, "a diagnosis with no service and no conception date was accepted");
    return `refused: ${String(r.error).slice(0, 70)}`;
  });
  await step("write", "Pregnancy Diagnosis: conception date, no prior service -> natural service created", async () => {
    const m = await ev("Pregnancy Diagnosis", { animal: ctx.cow4, event_date: today, operator: op, diagnosis_date: today, diagnosis_result: "Confirmed", conception_date: daysAgo(60), diagnosis_remarks: "smoke" });
    need(m, ["service", "service_created", "sire_animal", "sire_inferred", "sire_basis", "candidates"], "PD reply");
    check(m.service_created === true && m.service, `no natural service created: ${JSON.stringify(m).slice(0, 160)}`);
    check(m.warnings === undefined || Array.isArray(m.warnings), "warnings is not a list");
    track("Livestock Event", m.service);
    const svc = await doc("Livestock Event", m.service);
    check(svc.service_type === "Natural", `created service is ${svc.service_type}`);
    check(String(svc.conception_date || svc.service_date) === daysAgo(60), `conception ${svc.conception_date}/${svc.service_date}`);
    return `${m.name} + service ${m.service}, sire ${m.sire_animal || "none"}`;
  });

  // ---- Calving with no service on file --------------------------------------
  await step("write", "Calving: no service on file -> conception 280 d before, calf gets sire and dam's herd", async () => {
    const dam = ctx.calvingDam;
    const damHerd = ctx.calvingDamHerd;
    if (!dam) return "SKIPPED: no female past the calving interval";
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    const form = new FormData();
    form.append("file", new Blob([png], { type: "image/png" }), `smoke-calf-${Date.now()}.png`);
    form.append("is_private", "0");
    const up = msgOf(await http("POST", "/api/method/upload_file", { form }));
    track("File", up.name);
    const m = await ev("Calving", { dam, event_date: today, operator: op, outcome: "Live Birth", remarks: "smoke", calves: [{ sex: "Male", birth_weight: 34, herd: damHerd, health_status: "Healthy", photo: up.file_url }] });
    need(m, ["calves", "service", "service_created"], "calving reply");
    check(m.service_created === true, "no service was created for a calving with none on file");
    if (m.service) track("Livestock Event", m.service);
    check(m.calves.length === 1, `expected 1 calf, got ${m.calves.length}`);
    const calf = m.calves[0].animal;
    track("Animal", calf);
    check(/^B\d{3}\/\d{2}$/.test(calf), `bull calf number ${calf}`);
    const d = await doc("Animal", calf);
    check(d.dam === dam, `calf dam ${d.dam}`);
    check(d.current_herd === damHerd, `calf herd ${d.current_herd}, dam's herd ${damHerd}`);
    check(d.image === up.file_url, `calf image ${d.image}`);
    const svc = await doc("Livestock Event", m.service);
    check(svc.sire_animal ? d.sire === svc.sire_animal : true, `calf sire ${d.sire}, service sire ${svc.sire_animal}`);
    return `${calf} in ${d.current_herd}, sire ${d.sire || "unknown"}`;
  });

  // ---- Movement: calf -> feedlot ---------------------------------------------
  await step("write", "Movement: calf separation to the feedlot (no note needed)", async () => {
    const d = ctx.calfFeedlot;
    if (!d) return "SKIPPED: " + "no bull calf is due";
    const to = d.options.find((o) => o.stream === "Feedlot").herd;
    check(to, `no feedlot herd offered for ${d.animal}`);
    const m = await ev("Movement", { animal: d.animal, event_date: today, operator: op, new_herd: to, remarks: "smoke: calf separation" });
    need(m, ["stream"], "movement reply");
    check(m.warnings === undefined || Array.isArray(m.warnings), "warnings is not a list");
    check(m.stream === "Feedlot", `stream ${m.stream}`);
    const a = await doc("Animal", d.animal);
    check(a.current_herd === to, `herd ${a.current_herd}, expected ${to}`);
    check(a.stream === "Feedlot", `animal stream ${a.stream}`);
    ctx.movedFeedlot = { animal: d.animal, back: d.herd };
    return `${d.animal} ${d.herd} -> ${to}`;
  });

  // ---- Selection: calf -> breeding with the note -----------------------------
  await step("write", "Movement: selection refused without a note, and with a short one", async () => {
    const d = ctx.calfBreeding;
    if (!d) return "SKIPPED: " + "no second bull calf is due";
    const to = d.options.find((o) => o.stream === "Breeding").herds[0];
    ctx.selTo = to;
    const none = await evRaw("Movement", { animal: d.animal, event_date: today, operator: op, new_herd: to });
    check(none?.error, "a selection with no note was accepted");
    check(/describe the bull/i.test(none.error), `refusal words: ${none.error}`);
    const short = await evRaw("Movement", { animal: d.animal, event_date: today, operator: op, new_herd: to, remarks: "good bull" });
    check(short?.error, "a 9-character note was accepted (minimum is 20)");
    const a = await doc("Animal", d.animal);
    check(a.current_herd === d.herd, `he moved anyway: ${a.current_herd}`);
    return "refused without a note and with 9 characters";
  });
  await step("write", "Movement: selection with the note sets stream and breeding note", async () => {
    const d = ctx.calfBreeding;
    if (!d) return "SKIPPED: " + "no second bull calf is due";
    const note = "Smoke: heavy for his age, calm, dam calves yearly";
    const m = await ev("Movement", { animal: d.animal, event_date: today, operator: op, new_herd: ctx.selTo, remarks: note });
    check(m.stream === "Breeding", `stream ${m.stream}`);
    const a = await doc("Animal", d.animal);
    check(a.stream === "Breeding", `animal stream ${a.stream}`);
    check(a.breeding_note === note, `breeding_note ${JSON.stringify(a.breeding_note)}`);
    check(a.breeding_note_by === op, `breeding_note_by ${a.breeding_note_by}, operator ${op}`);
    check(String(a.breeding_note_on).startsWith(today), `breeding_note_on ${a.breeding_note_on}`);
    const evs = msgOf(await get("/api/resource/Livestock Event", { fields: ["name", "remarks", "new_herd"], filters: [["animal", "=", d.animal], ["event_type", "=", "Movement"], ["docstatus", "=", 1]], order_by: "creation desc", limit_page_length: 3 }));
    check(evs[0]?.remarks === note, "the note is not in the animal's movement history");
    ctx.selected = { animal: d.animal, from: d.herd, to: ctx.selTo };
    return `${d.animal} -> ${ctx.selTo}, stream Breeding, note saved by ${op}`;
  });

  // ---- Kinship: preview, then a warned move ----------------------------------
  await step("write", "kinship_check preview + a warned move (dam-son / sire-daughter / siblings)", async () => {
    // Look for a pair the seed planted: any bull x breeding herd the server warns about.
    const bulls = (ctx.animals || []).filter((a) => a.sex?.[0] === "M" && a.stage !== "retired" && (a.dam || a.sire) && (Date.now() - Date.parse(a.dob)) / 86_400_000 > 400);
    let hit;
    for (const b of bulls) {
      for (const herd of ctx.breedingHerds) {
        if (herd === b.herd) continue;
        const k = msgOf(await post(`${M}.movement.kinship_check.kinship_check`, { animal: b.name, herd }));
        if (k.warnings.length) { hit = { b, herd, k }; break; }
      }
      if (hit) break;
    }
    if (!hit) return "SKIPPED: " + "the server found no kinship conflict among the bulls tried";
    const { b, herd, k } = hit;
    need(k.conflicts[0], ["other", "other_label", "relation", "shared_parent", "message"], "conflict");
    check(["sire-daughter", "dam-son", "full-siblings", "half-siblings"].includes(k.conflicts[0].relation), `relation ${k.conflicts[0].relation}`);
    check(k.warnings.every((w) => typeof w === "string"), "a warning is not text");
    await snapshot([b.name]);
    const note = "Smoke: moved to test the inbreeding warning";
    const m = await ev("Movement", { animal: b.name, event_date: today, operator: op, new_herd: herd, remarks: note });
    check(Array.isArray(m.warnings) && m.warnings.length, "the move came back with no warnings");
    const evd = await doc("Livestock Event", m.name);
    check(evd.kinship_warnings, "kinship_warnings was not saved on the event");
    ctx.kinMoved = { animal: b.name, back: b.herd };
    return `${b.name} -> ${herd}: ${k.conflicts[0].relation} (${k.warnings[0]})`.slice(0, 110);
  });

  // Put every moved animal back where it was (Movement events cannot be deleted).
  await step("write", "restore: moved animals go back to their herds", async () => {
    const back = [ctx.kinMoved && { animal: ctx.kinMoved.animal, herd: ctx.kinMoved.back }, ctx.selected && { animal: ctx.selected.animal, herd: ctx.selected.from }, ctx.movedFeedlot && { animal: ctx.movedFeedlot.animal, herd: ctx.movedFeedlot.back }].filter(Boolean);
    for (const x of back) {
      const r = await evRaw("Movement", { animal: x.animal, event_date: today, operator: op, new_herd: x.herd, remarks: "smoke: restore to the herd he was in for the test run" });
      if (r?.name) track("Livestock Event", r.name);
      check(!r?.error, `${x.animal} back to ${x.herd}: ${r?.error}`);
    }
    return `${back.length} moved back`;
  });
}

async function nonEmployee() {
  await step("non-employee", "login as a user with no Employee", () => login(NONEMP_USER, NONEMP_PASS));
  await step("non-employee", "posting_day: is_employee is false", async () => {
    const m = msgOf(await get(`${M}.settings.posting_day.posting_day`));
    check(m.is_employee === false, `is_employee ${m.is_employee}`);
  });
  await step("non-employee", "reads still work (bootstrap)", async () => {
    msgOf(await post(`${M}.mobile.get_bootstrap_bundle.get_bootstrap_bundle`, {}));
  });
  const refused = (name, call) =>
    step("non-employee", `${name} is refused with not_employee`, async () => {
      const r = await call();
      const m = r.data?.message;
      check(!(r.status === 200 && m && !m.error), `was accepted: ${JSON.stringify(m)?.slice(0, 120)}`);
      check(m?.code === "not_employee", `refused, but with code ${m?.code ?? r.status}, not not_employee`);
    });
  const animal = ctx.animal || ctx.cow || "x";
  await refused("Weight session", () => post(`${M}.weights.record_weights.record_weights`, { payload: { method: ctx.weightMethod || "Platform Scale", weights: [{ animal, weight_kg: 400 }] } }));
  await refused("Movement", () => post(`${M}.mobile.record_animal_event.record_animal_event`, { payload: { type: "Movement", animal, new_herd: ctx.breedingHerds?.[0] || "x", event_date: today } }));
  await refused("Service", () => post(`${M}.mobile.record_animal_event.record_animal_event`, { payload: { type: "Service", animal, event_date: today, service_date: today } }));
}

// ---------------------------------------------------------------------------
async function cleanup() {
  // A calving also books its birth, a service and a confirmation the reply does not
  // all name, so besides what the steps tracked, sweep every event and weight this
  // user created since the run began (newest first), then the animals, then files.
  const swept = [];
  for (const doctype of ["Livestock Event", "Livestock Weight Record"]) {
    const l = msgOf(await get(`/api/resource/${doctype}`, { fields: ["name", "creation"], filters: [["owner", "=", USER], ["creation", ">=", ctx.syncTime]], order_by: "creation desc", limit_page_length: 500 }));
    for (const x of l) swept.push({ doctype, name: x.name, at: x.creation });
  }
  swept.sort((x, y) => (x.at < y.at ? 1 : -1));
  const known = (d) => created.filter((c) => c.doctype === d);
  created.splice(0, created.length, ...swept.map(({ doctype, name }) => ({ doctype, name })), ...known("Animal"), ...known("File"));
  const out = { removed: 0, kept: [] };
  const text = (x) => String(x.data?.exception || x.data?._server_messages || "").replace(/<[^>]+>/g, " ").slice(0, 110);
  let left = [...created].reverse();
  // Documents link to each other (a calving to its birth, a birth to its calf), so a
  // refusal on one pass is retried after the others have gone.
  for (let pass = 0; pass < 5 && left.length; pass++) {
    const next = [];
    for (const item of left) {
      const { doctype, name } = item;
      const path = `/api/resource/${doctype}/${encodeURIComponent(name)}`;
      let r = await http("DELETE", path);
      let why = `delete ${r.status} ${text(r)}`;
      if (r.status !== 202 && r.status !== 200) {
        // Submitted: cancel, then delete.
        const c = await post("/api/method/frappe.client.cancel", { doctype, name });
        r = await http("DELETE", path);
        why = `cancel ${c.status} ${text(c)}; delete ${r.status} ${text(r)}`;
      }
      if (r.status === 202 || r.status === 200 || r.status === 404) out.removed++;
      else next.push({ ...item, why });
    }
    left = next;
  }
  out.kept = left.map((x) => `${x.doctype} ${x.name} (${x.why})`);
  return out;
}

if (WRITE) {
  if (rows.every((r) => r.ok)) await writes();
  else rows.push({ group: "write", name: "writes skipped: the reads above failed", ok: false, note: "" });
}
if (NONEMP_USER && NONEMP_PASS) {
  ctx.animal ||= "x";
  await nonEmployee();
}
if (WRITE && CLEANUP && created.length) {
  // The user may have changed (non-employee run): log back in as the herdsman.
  try {
    await login(USER, PASS);
    const c = await cleanup();
    const a = await restoreAnimals();
    rows.push({ group: "cleanup", name: `put back what the events stamped on ${snapshots.size} animals`, ok: a.failed.length === 0, note: a.failed.length ? `NOT RESTORED: ${a.failed.join(" | ")}`.slice(0, 500) : `${a.fixed} animals fixed` });
    rows.push({ group: "cleanup", name: `removed what the run created (${created.length} documents)`, ok: c.kept.length === 0, note: c.kept.length ? `KEPT ${c.kept.length}: ${c.kept.join(" | ")}`.slice(0, 1500) : `${c.removed} removed` });
  } catch (e) {
    rows.push({ group: "cleanup", name: "cleanup", ok: false, note: String(e.message || e) });
  }
}

const w = Math.max(...rows.map((r) => r.name.length));
for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(w)}  ${r.note}`);
const bad = rows.filter((r) => !r.ok).length;
console.log(`\n${rows.length - bad}/${rows.length} passed`);
if (created.length) console.log("CREATED " + JSON.stringify(created));
process.exit(bad ? 1 : 0);
