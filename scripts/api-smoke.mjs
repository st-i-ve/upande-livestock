#!/usr/bin/env node
/**
 * Smoke test: every network call the app makes, against a real backend.
 *
 *   LIVESTOCK_URL=http://localhost:8000 LIVESTOCK_USER=... LIVESTOCK_PASSWORD=... \
 *   [WRITE=1] [SMOKE_ANIMALS=A,B,C] [SMOKE_HERD=...] \
 *   node scripts/api-smoke.mjs
 *
 * Logs in the way the app does (POST /api/method/login, session cookie), then
 * replays the app's reads with its exact params and checks the keys it reads.
 * With WRITE=1 it also records one of each thing the phone records. Writes go
 * against SMOKE_ANIMALS (three test females in SMOKE_HERD, a milking herd) and
 * print every document they created as JSON on the last line, for cleanup.
 * SMOKE_SEMEN=<item> also books the straw issue of a Service (it needs real
 * stock behind it).
 *
 * Vets are records on the server (Livestock Vet). With SMOKE_VET_EXTERNAL and
 * SMOKE_VET_INTERNAL (the names of one enabled vet of each kind) the write steps
 * also send `vet` and check it was saved, and the vet-fee branches are exercised:
 * an internal vet with a fee is refused; an external vet's fee is recorded, and
 * is posted as a Journal Entry when SMOKE_VET_POSTS=1 (that vet has a Supplier
 * and Livestock Settings names a vet expense account). Create the test vets,
 * Employee and Supplier yourself and remove them afterwards.
 *
 * THE TEST USER (a System User; nothing else makes this green):
 *   - an Employee record with user_id = that user and employee_name set (the
 *     app learns who the user is from posting_day, so no Employee role is needed;
 *     a user without an Employee is view-only, see WHO MAY RECORD below)
 *   - role Livestock Manager. That is all: the feeding steps book Stock Entries and
 *     Work Orders on the server after its own role check, so no ERPNext role
 *     (Stock User, Manufacturing User ...) is needed.
 *   frappe.get_doc("User", u).add_roles("Livestock Manager")
 * SMOKE_ANIMALS: three adult females in a milking herd, EXCEPT the third, which
 * must be under 6 months old (the Dehorning step is refused on an older animal).
 * Remove the user, Employee and animals afterwards.
 *
 * WHO MAY RECORD (both optional; each is a step group of its own):
 *   SMOKE_NONEMP_USER / SMOKE_NONEMP_PASSWORD: a user with a livestock role but NO
 *     Employee. Must be view-only: posting_day says is_employee false, the reads
 *     still answer, and every recording endpoint refuses with code not_employee
 *     (and the milking-specific words for milking).
 *   SMOKE_ROLES='{"Livestock Milker":{"user":"..","password":".."}, ...}': one test
 *     user per role (Livestock Milker, Livestock Attendant, Livestock Breeder,
 *     Livestock Vet, Livestock Stores, Livestock Manager), each holding ONLY that
 *     role plus an Employee with user_id set. Each is logged in and must be able to
 *     make the reads the app makes for its screens and to record what its role
 *     records, with no ERPNext role. A 403 or "not permitted" fails the step.
 *     Roles' writes need WRITE=1 (and SMOKE_ANIMALS / SMOKE_HERD).
 * QUALITY (optional step group): SMOKE_QUALITY_USER / SMOKE_QUALITY_PASSWORD, a user
 *   holding ONLY Livestock Quality plus an Employee with user_id set. It must be told
 *   its role by posting_day (roles == ["Livestock Quality"]), read both quality pages,
 *   file milk quality against SMOKE_QUALITY_RECORDING (default: the milking the WRITE
 *   steps recorded; the filing step is skipped when there is neither), and be refused
 *   for milking, events and feeding. Remove that user and its Employee afterwards.
 * Remove those users, their Employees and everything they recorded afterwards.
 * Point it at a development site only.
 */
import { Buffer } from "node:buffer";

const URL_ = process.env.LIVESTOCK_URL;
const USER = process.env.LIVESTOCK_USER;
const PASS = process.env.LIVESTOCK_PASSWORD;
const WRITE = process.env.WRITE === "1";
const [F1, F2, F3] = (process.env.SMOKE_ANIMALS || "").split(",");
const HERD = process.env.SMOKE_HERD;
const VET_EXT = process.env.SMOKE_VET_EXTERNAL;
const VET_INT = process.env.SMOKE_VET_INTERNAL;
const VET_POSTS = process.env.SMOKE_VET_POSTS === "1";
const NONEMP_USER = process.env.SMOKE_NONEMP_USER;
const NONEMP_PASS = process.env.SMOKE_NONEMP_PASSWORD;
const QUALITY_USER = process.env.SMOKE_QUALITY_USER;
const QUALITY_PASS = process.env.SMOKE_QUALITY_PASSWORD;
const ROLES = process.env.SMOKE_ROLES ? JSON.parse(process.env.SMOKE_ROLES) : null;
if (!URL_ || !USER || !PASS) {
  console.error("Set LIVESTOCK_URL, LIVESTOCK_USER and LIVESTOCK_PASSWORD.");
  process.exit(2);
}
if (WRITE && !(F1 && F2 && F3 && HERD)) {
  console.error("WRITE=1 needs SMOKE_ANIMALS=a,b,c and SMOKE_HERD.");
  process.exit(2);
}

const M = "/api/method/upande_livestock.serverscripts";
let cookie = "";
const today = new Date().toISOString().slice(0, 10);
const created = []; // {doctype, name}
const rows = [];

async function http(method, path, { params, body, form } = {}) {
  const url = new URL(URL_ + path);
  for (const [k, v] of Object.entries(params || {}))
    url.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
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

async function step(group, name, fn) {
  try {
    const note = await fn();
    rows.push({ group, name, ok: true, note: note ? String(note).slice(0, 90) : "" });
  } catch (e) {
    rows.push({ group, name, ok: false, note: String(e.message || e).slice(0, 400) });
  }
}
const track = (doctype, name) => name && created.push({ doctype, name });

const ctx = {};

// ---------------------------------------------------------------------------
async function login(user, pass) {
  const body = new URLSearchParams({ usr: user, pwd: pass });
  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  const res = await fetch(URL_ + "/api/method/login", { method: "POST", headers, body });
  cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const j = await res.json();
  if (res.status !== 200 || !cookie) throw new Error(`login ${res.status} ${JSON.stringify(j)}`);
  return j.full_name;
}
await step("auth", "POST /api/method/login", () => login(USER, PASS));
await step("auth", "frappe.auth.get_logged_user", async () => {
  const m = msgOf(await get("/api/method/frappe.auth.get_logged_user"));
  if (m !== USER) throw new Error(`logged in as ${m}`);
});

// ---------------------------------------------------------------------------
// READS — the app's exact calls
await step("read", "mobile.get_bootstrap_bundle (useHerds)", async () => {
  const m = msgOf(await post(`${M}.mobile.get_bootstrap_bundle.get_bootstrap_bundle`, {}));
  need(m.herds?.[0], ["name", "label", "heads", "category", "is_milking", "is_dry", "has_bom"], "herd");
  ctx.herds = m.herds;
  return `${m.herds.length} herds`;
});
await step("read", "settings.posting_day (server today + backdating open?)", async () => {
  const m = msgOf(await get(`${M}.settings.posting_day.posting_day`));
  need(m, ["today", "backdating_open", "is_employee", "employee", "employee_name"], "posting_day");
  return `today ${m.today}, backdating ${m.backdating_open ? "OPEN" : "closed"}`;
});
const SYNC_FIELDS = ["name", "tag", "animal_name", "sex", "breed", "dob", "herd", "status", "stage", "repro_status", "image", "dam", "sire", "parity", "last_weight_kg", "modified"];
await step("read", "mobile.animals_since full (offline store, login)", async () => {
  const m = msgOf(await get(`${M}.mobile.animals_since.animals_since`));
  need(m, ["server_time", "animals", "removed"], "animals_since");
  if (m.removed.length) throw new Error("a full sync must not name removed animals");
  need(m.animals[0], SYNC_FIELDS, "animal row");
  ctx.animal = m.animals[0].name;
  ctx.syncTime = m.server_time;
  ctx.syncCount = m.animals.length;
  return `${m.animals.length} animals, ${JSON.stringify(m).length} bytes`;
});
await step("read", "mobile.animals_since delta (foreground / pull-to-refresh)", async () => {
  const m = msgOf(await get(`${M}.mobile.animals_since.animals_since`, { since: ctx.syncTime }));
  need(m, ["server_time", "animals", "removed"], "animals_since delta");
  if (m.animals.length > ctx.syncCount) throw new Error("a delta returned more than the full set");
  return `${m.animals.length} changed, ${m.removed.length} removed`;
});
await step("read", "GET Animal/<name> (useAnimal)", async () => {
  const m = msgOf(await get(`/api/resource/Animal/${encodeURIComponent(ctx.animal)}`));
  need(m, ["name", "sex", "status"], "animal doc"); // null fields (dam, sire_name...) are simply absent
});
await step("read", "animals.animal_profile (days in milk)", async () => {
  const m = msgOf(await post(`${M}.animals.animal_profile.animal_profile`, { payload: { animal: ctx.animal } }));
  need(m.cycle, ["daysInMilk"], "cycle");
});
await step("read", "animals.animal_standing (performance vs herd and group)", async () => {
  const m = msgOf(await post(`${M}.animals.animal_standing.animal_standing`, { payload: { animal: ctx.animal } }));
  need(m, ["asOf", "herd", "group", "per_animal_milk", "metrics"], "standing");
  const first = m.metrics?.[0];
  if (!first) throw new Error("no metrics");
  need(first, ["key", "label", "value", "herd", "group"], "metric");
  need(first.group, ["avg", "n", "top"], "peers");
});
await step("read", "GET Livestock Health Case (open case of an animal)", async () => {
  msgOf(await get("/api/resource/Livestock Health Case", {
    fields: ["name", "milk_safe_date"],
    filters: [["animal", "=", ctx.animal], ["docstatus", "=", 1], ["case_status", "in", ["Open", "Under Treatment"]]],
    limit_page_length: 1,
  }));
});
await step("read", "GET Livestock Event list (useAnimalEvents)", async () => {
  const f = ["name", "animal", "event_type", "event_date", "current_herd", "new_herd", "diagnosis_result", "docstatus", "custom_is_backdated", "custom_feed_mode"];
  const m = msgOf(await get("/api/resource/Livestock Event", {
    fields: f, filters: [["docstatus", "=", 1]], order_by: "event_date desc", limit_page_length: 20,
  }));
  if (m.length) need(m[0], f, "event row");
  return `${m.length} events`;
});
await step("read", "posting_day names the Employee (useOperator, login)", async () => {
  const m = msgOf(await get(`${M}.settings.posting_day.posting_day`));
  if (!m.is_employee || !m.employee) throw new Error("no Employee linked to this user");
  ctx.employee = m.employee;
  return `${m.employee} ${m.employee_name}`;
});
await step("read", "people.employee_options (operator picker, no Employee role needed)", async () => {
  const m = msgOf(await post(`${M}.people.employee_options.employee_options`, { payload: {} }));
  need(m, ["employees", "mine"], "employee_options");
  return `${m.employees.length} rows, mine=${m.mine}`;
});
await step("read", "get_single_value Livestock Settings.custom_default_company", async () => {
  const m = msgOf(await get("/api/method/frappe.client.get_single_value", { doctype: "Livestock Settings", field: "custom_default_company" }));
  if (!m) throw new Error("empty");
  ctx.company = m;
  return m;
});
await step("read", "GET Livestock Settings doc (useLivestockSettings)", async () => {
  const m = msgOf(await get("/api/resource/Livestock Settings/Livestock Settings"));
  need(m, ["high_yield_herd", "female_calf_herd", "male_calf_herd", "growth_ladder"], "settings");
});
await step("read", "movement.eligibility (useEligibility)", async () => {
  const m = msgOf(await post(`${M}.movement.eligibility.eligibility`, {}));
  need(m, ["milking_herds", "service_herds", "service_wait_days", "growth_ladder", "next_herd", "calf_herds", "diagnosable"], "eligibility");
  ctx.elig = m;
});
await step("read", "movement.movement_suggestions", async () => {
  const m = msgOf(await post(`${M}.movement.movement_suggestions.movement_suggestions`, {}));
  need(m, ["growth"], "suggestions");
  if (m.growth[0]) need(m.growth[0], ["animal", "label", "from_herd", "to_herd", "reason", "overdue"], "suggestion");
});
await step("read", "people.vet_options (useVets)", async () => {
  const m = msgOf(await post(`${M}.people.vet_options.vet_options`, { payload: {} }));
  need(m, ["vets", "mine"], "vet_options");
  for (const v of m.vets) need(v, ["value", "label", "type", "detail"], "vet option");
  for (const want of [VET_EXT, VET_INT].filter(Boolean))
    if (!m.vets.some((v) => v.value === want)) throw new Error(`${want} is not offered (disabled or missing)`);
  return `${m.vets.length} vets, mine=${m.mine}`;
});
await step("read", "health.health_options (useEventItems)", async () => {
  const m = msgOf(await post(`${M}.health.health_options.health_options`, {}));
  need(m, ["items_by_event", "diseases", "appearances", "hydrations", "actions", "severities", "routes", "responses", "employee", "company"], "options");
  ctx.opts = m;
});
await step("read", "GET Item search (feeding: add an ingredient)", async () => {
  msgOf(await get("/api/resource/Item", { fields: ["name", "item_name", "item_code", "stock_uom"], filters: [["disabled", "=", 0], ["is_stock_item", "=", 1], ["item_name", "like", "%a%"]], limit_page_length: 30 }));
});
await step("read", "mobile.get_livestock_stock (the read-only Stock list)", async () => {
  const m = msgOf(await post(`${M}.mobile.get_livestock_stock.get_livestock_stock`, {}));
  need(m, ["as_of", "stores", "count"], "livestock stock");
  for (const st of m.stores) need(st, ["warehouse", "items"], "store");
  const first = m.stores[0]?.items[0];
  if (first) need(first, ["item_code", "item_name", "uom", "qty", "events"], "stock item");
  return `${m.count} items in ${m.stores.length} stores`;
});
await step("read", "feeding.herd_recipes (useHerdRecipes)", async () => {
  const herd = ctx.herds.find((h) => h.has_bom)?.name;
  const m = msgOf(await post(`${M}.feeding.herd_recipes.herd_recipes`, { herd }));
  need(m, ["herd", "standing_bom", "recipes"], "recipes");
  need(m.recipes[0], ["bom_no", "item_code", "item_name", "kind", "is_standing", "created", "per_head_qty", "uom", "lines"], "recipe");
  ctx.feedHerd = herd;
});
await step("read", "mobile.record_feeding action=info", async () => {
  const m = msgOf(await post(`${M}.mobile.record_feeding.record_feeding`, { payload: { action: "info", herd: ctx.feedHerd } }));
  need(m, ["herd", "bom_no", "production_item", "heads", "per_head_qty", "total_manufacture_qty", "uom", "store", "available_in_store", "lines"], "feeding info");
});
await step("read", "mobile.record_feeding action=day", async () => {
  msgOf(await post(`${M}.mobile.record_feeding.record_feeding`, { payload: { action: "day", herd: ctx.feedHerd } }));
});
await step("read", "mobile.get_concentrate_plan / get_animal_bundle", async () => {
  msgOf(await post(`${M}.mobile.get_animal_bundle.get_animal_bundle`, {}));
});

// ---------------------------------------------------------------------------
async function ev(type, payload) {
  const m = msgOf(await post(`${M}.mobile.record_animal_event.record_animal_event`, { payload: { type, ...payload } }));
  track("Livestock Event", m.name);
  for (const n of m.names || []) track("Livestock Event", n);
  if (m.stock_entry) track("Stock Entry", m.stock_entry);
  return m;
}
const drug = () => {
  const c = ctx.opts.items_by_event.Vaccination?.[0];
  return c && { item_code: c.value, qty: 1, source_warehouse: c.warehouse, uom: c.uom };
};
async function got(doctype, name) {
  return msgOf(await get(`/api/resource/${doctype}/${encodeURIComponent(name)}`));
}
function same(doc, want, label) {
  const bad = [];
  for (const [k, v] of Object.entries(want)) {
    if (v === undefined || v === null || v === "") continue;
    const have = doc[k];
    const ok = typeof v === "number" ? Number(have) === v : String(have) === String(v);
    if (!ok) bad.push(`${k}: sent ${JSON.stringify(v)} saved ${JSON.stringify(have)}`);
  }
  if (bad.length) throw new Error(`${label} dropped/changed: ${bad.join("; ")}`);
}

async function writes() {
  const op = ctx.employee;
  // A straw that is genuinely in stock (with a ledger behind it) — optional.
  const sem = process.env.SMOKE_SEMEN
    ? ctx.opts.items_by_event.Service.find((c) => c.value === process.env.SMOKE_SEMEN)
    : undefined;

  await step("write", "Weight Recording", async () => {
    const m = await ev("Weight Recording", { animal: F1, weight_date: today, measured_by: op, weight_kg: 480, bcs: 3.5, method: "Platform Scale", remarks: "smoke" });
    return m.name;
  });
  // The weighing session the phone's Weight screen sends: one call, three
  // animals, one of them unknown to the server. The good two must be saved and
  // the bad one reported with its reason, not allowed to sink the round.
  await step("write", "weights.record_weights session (2 good + 1 refused)", async () => {
    const opts = msgOf(await get(`${M}.weights.weight_options.weight_options`, { settings_only: 1 }));
    need(opts, ["methods", "default_method", "weighbridge_available"], "weight_options");
    const bad = "ZZ-NO-SUCH-ANIMAL";
    const m = msgOf(await post(`${M}.weights.record_weights.record_weights`, {
      payload: {
        method: opts.default_method, measured_by: op,
        weights: [{ animal: F2, weight_kg: 455 }, { animal: bad, weight_kg: 300 }, { animal: F3, weight_kg: 120 }],
      },
    }));
    for (const r of m.recorded) { const name = r.name; track("Livestock Weight Record", name); }
    if (m.count !== 2 || m.failed.length !== 1 || m.failed[0].animal !== bad || !m.failed[0].why) {
      throw new Error(`expected 2 saved + 1 refused, got ${JSON.stringify(m)}`);
    }
    const delta = msgOf(await get(`${M}.mobile.animals_since.animals_since`, {}));
    const row = (delta.animals || []).find((x) => x.name === F2);
    if (row && Number(row.last_weight_kg) !== 455) throw new Error(`last_weight_kg is ${row.last_weight_kg}, not 455`);
    return `${m.count} saved, refused: ${m.failed[0].why}`.slice(0, 90);
  });
  await step("write", "Heat Detection", async () => (await ev("Heat Detection", { animal: F3, event_date: today, operator: op, remarks: "smoke" })).name);
  await step("write", "Service", async () => {
    // As the phone sends it: the straw is an items line, and only when the Service
    // event type posts stock (its key is in items_by_event); no item fields otherwise.
    const mapped = Object.prototype.hasOwnProperty.call(ctx.opts.items_by_event, "Service");
    const items = mapped && sem ? [{ item_code: sem.value, qty: 1, source_warehouse: sem.warehouse }] : undefined;
    const m = await ev("Service", { animal: F1, event_date: today, operator: op, service_type: "A.I.", service_date: today, items, sire: "SMOKE SIRE", remarks: "smoke" });
    ctx.service1 = m.name;
    return m.name;
  });
  await step("write", "Service (second cow, for the abortion)", async () => {
    const m = await ev("Service", { animal: F2, event_date: today, operator: op, service_type: "Natural", service_date: today, remarks: "smoke" });
    ctx.service2 = m.name;
    return m.name;
  });
  await step("write", "Pregnancy Diagnosis (Confirmed)", async () => {
    const m = await ev("Pregnancy Diagnosis", { animal: F1, event_date: today, operator: op, diagnosis_date: today, diagnosis_result: "Confirmed", related_service: ctx.service1, diagnosis_remarks: "smoke", vet: VET_EXT });
    ctx.pd1 = m.name;
    if (VET_EXT) same(await got("Livestock Event", m.name), { vet: VET_EXT }, "pregnancy diagnosis");
    return m.name;
  });
  await step("write", "Pregnancy Diagnosis (second cow)", async () => {
    const m = await ev("Pregnancy Diagnosis", { animal: F2, event_date: today, operator: op, diagnosis_date: today, diagnosis_result: "Confirmed", related_service: ctx.service2 });
    ctx.pd2 = m.name;
  });
  await step("write", "Abortion", async () => (await ev("Abortion", { animal: F2, event_date: today, operator: op, abortion_cause: "Unknown", abortion_notes: "smoke" })).name); // the app sends no related_pregnancy; the server finds the open one
  await step("write", "Drying Off", async () => {
    const d = drug();
    const m = await ev("Drying Off", { animal: F1, event_date: today, operator: op, vet: VET_INT, new_herd: ctx.elig.next_herd?.[HERD] || ctx.herds.find((h) => h.is_dry)?.name || ctx.herds[0].name, drugs: d ? [d] : [], remarks: "smoke" });
    if (VET_INT) same(await got("Livestock Event", m.name), { vet: VET_INT }, "drying off");
    return m.name;
  });
  await step("write", "Calving (live birth) with photo: upload_file + calf image", async () => {
    // a 1x1 png, uploaded exactly like the app (multipart `file`, is_private=0)
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    const form = new FormData();
    form.append("file", new Blob([png], { type: "image/png" }), `smoke-calf-${Date.now()}.png`);
    form.append("is_private", "0");
    const up = msgOf(await http("POST", "/api/method/upload_file", { form }));
    need(up, ["file_url"], "upload");
    track("File", up.name);
    // Twins, and the old single-calf payload's typed name: the server ignores it
    // and numbers both calves itself, A for a heifer and B for a bull.
    const m = await ev("Calving", {
      dam: F1, event_date: today, operator: op, outcome: "Live Birth", remarks: "smoke · Coat: Black",
      calves: [
        { name: "A", sex: "Female", birth_weight: 32, herd: ctx.elig.calf_herds.female || ctx.herds[0].name, health_status: "Healthy", photo: up.file_url },
        { sex: "Female", birth_weight: 30, health_status: "Healthy" },
        { sex: "Male", birth_weight: 34, health_status: "Weak" },
      ],
    });
    need(m, ["calves"], "birth reply");
    if (m.calves.length !== 3) throw new Error(`expected 3 calves, got ${m.calves.length}`);
    for (const c of m.calves) track("Animal", c.animal);
    const [c1, c2, c3] = m.calves.map((c) => c.animal);
    const seq = (n) => Number(n.slice(1, 4));
    if (!/^A\d{3}\/\d{2}$/.test(c1) || !/^A\d{3}\/\d{2}$/.test(c2) || !/^B\d{3}\/\d{2}$/.test(c3)) throw new Error(`numbers not A/A/B series: ${c1} ${c2} ${c3}`);
    if (seq(c2) !== seq(c1) + 1) throw new Error(`twins not sequential: ${c1} ${c2}`);
    for (const c of [c1, c2, c3]) same(await got("Animal", c), { tag_number: c, book_number: c }, `book number of ${c}`);
    const doc = await got("Animal", c1);
    if (doc.image !== up.file_url) throw new Error(`calf image ${doc.image} != ${up.file_url}`);
    return `${c1} ${c2} ${c3} image ok`;
  });
  await step("write", "Movement", async () => {
    const to = ctx.herds.find((h) => h.name !== HERD && !h.is_milking)?.name;
    const m = await ev("Movement", { animal: F3, event_date: today, operator: op, new_herd: to, remarks: "smoke" });
    const back = await ev("Movement", { animal: F3, event_date: today, operator: op, new_herd: HERD, remarks: "smoke back" });
    return `${m.name} -> ${to} -> ${back.name}`;
  });
  for (const t of ["Vaccination", "Deworming", "Hoof Trimming", "Dehorning"]) {
    await step("write", `${t} round (+vet_fee)`, async () => {
      const d = ["Vaccination", "Deworming"].includes(t) ? drug() : null;
      const m = await ev(t, { event_date: today, operator: op, vet: VET_EXT, animals: t === "Dehorning" ? [F3] : [F1, F3], drugs: d ? [{ ...d, withdrawal_days: 2 }] : [], vet_fee: 1500, remarks: `smoke ${t}` });
      if (!m.vet_fee || m.vet_fee.amount !== 1500) throw new Error("vet_fee not echoed");
      if (m.vet_fee.journal_entry) track("Journal Entry", m.vet_fee.journal_entry);
      if (VET_EXT && VET_POSTS && !m.vet_fee.posted) throw new Error(`fee not posted: ${m.vet_fee.reason}`);
      if (VET_EXT && !VET_POSTS && m.vet_fee.posted) throw new Error("fee posted though SMOKE_VET_POSTS is not set");
      if (!m.vet_fee.posted && !m.vet_fee.reason) throw new Error("an unposted fee must say why");
      const doc = await got("Livestock Event", m.name);
      same(doc, { event_type: t, operator: op, event_date: today, vet: VET_EXT }, `${t} event`);
      if (!String(doc.remarks || "").includes(`smoke ${t}`)) throw new Error("remarks dropped");
      if (!String(doc.remarks || "").includes("1,500")) throw new Error("vet fee not on the first event");
      if (d) {
        const row = doc.drug_issues?.[0];
        if (!row) throw new Error("drug row dropped");
        same(row, { item_code: d.item_code, qty: 1, source_warehouse: d.source_warehouse, withdrawal_days: 2 }, "drug row");
      }
      return `${m.animals} animals${m.stock_entry ? " SE " + m.stock_entry : ""}`;
    });
  }
  if (VET_INT) {
    await step("write", "husbandry: an internal vet with a fee is refused, nothing recorded", async () => {
      const r = await post(`${M}.mobile.record_animal_event.record_animal_event`, { payload: { type: "Hoof Trimming", event_date: today, operator: op, vet: VET_INT, animals: [F3], vet_fee: 800 } });
      const m = r.data?.message;
      if (!m?.error) throw new Error("an internal vet's fee was accepted");
      if (!/no vet fee/i.test(m.error)) throw new Error(`unexpected refusal: ${m.error}`);
      return m.error.slice(0, 60);
    });
  }
  await step("write", "mobile.record_milking", async () => {
    const m = msgOf(await post(`${M}.mobile.record_milking.record_milking`, { payload: {
      herd: HERD, milking_time: "05:30", recording_date: today, total_yield_kg: 120, discarded_kg: 5, net_yield_kg: 115,
      discard_reason: "Mastitis", cows_milked: 10, operator: op, remarks: "smoke" } }));
    track("Milk Recording", m.name);
    ctx.milking = m.name; // the quality group files lab figures against it
    const doc = await got("Milk Recording", m.name);
    same(doc, { herd: HERD, total_yield_kg: 120, discarded_kg: 5, cows_milked: 10 }, "milk recording");
    return m.name;
  });
  await step("write", "mobile.record_milking: offline late-sync is a manager setting", async () => {
    const pd = msgOf(await get(`${M}.settings.posting_day.posting_day`));
    if (pd.backdating_open) return "skipped: backdating is open on this site";
    const setGrace = async (v) => msgOf(await post("/api/method/frappe.client.set_value", { doctype: "Livestock Settings", name: "Livestock Settings", fieldname: "allow_offline_milking_grace", value: v }));
    const was = msgOf(await get("/api/method/frappe.client.get_single_value", { doctype: "Livestock Settings", field: "allow_offline_milking_grace" }));
    const day = (n) => new Date(Date.parse(pd.today) - n * 864e5).toISOString().slice(0, 10);
    const base = { herd: HERD, milking_time: "05:30", total_yield_kg: 10, cows_milked: 1, operator: op, remarks: "smoke offline", offline: 1, captured_at: `${day(1)} 05:35:00` };
    const send = async (n) => (await post(`${M}.mobile.record_milking.record_milking`, { payload: { ...base, recording_date: day(n) } })).data?.message;
    try {
      await setGrace(1);
      const old = await send(3);
      if (!old?.error || !/more than a day old/i.test(old.error)) throw new Error(`an offline milking 3 days old was not refused clearly: ${JSON.stringify(old)}`);
      await setGrace(0);
      const off = await send(1);
      if (!off?.error || !/late offline syncs are switched off/i.test(off.error)) throw new Error(`grace off did not refuse with the manager message: ${JSON.stringify(off)}`);
      await setGrace(1);
      const m = await send(1);
      if (m?.error) throw new Error(m.error);
      track("Milk Recording", m.name);
      const doc = await got("Milk Recording", m.name);
      same(doc, { captured_offline: 1, late_sync_grace: 1 }, "offline milking");
      if (!doc.posted_by_user) throw new Error("who posted the late sync was not stored");
      return `${m.name} posted by ${doc.posted_by_name || doc.posted_by_user}`;
    } finally {
      await setGrace(was ? 1 : 0);
    }
  });
  await step("write", "feeding: manufacture (system)", async () => {
    const m = msgOf(await post(`${M}.mobile.record_feeding.record_feeding`, { payload: { action: "manufacture", herd: ctx.feedHerd, portion: 0.01, posting_date: today } }));
    track("Work Order", m.work_order);
    track("Stock Entry", m.transfer_stock_entry);
    track("Stock Entry", m.manufacture_stock_entry);
    return m.work_order;
  });
  await step("write", "feeding: manual recipe", async () => {
    const info = msgOf(await post(`${M}.mobile.record_feeding.record_feeding`, { payload: { action: "info", herd: ctx.feedHerd } }));
    const lines = info.lines.slice(0, 2).map((l) => ({ item_code: l.item_code, qty: l.recipe_qty ?? l.qty ?? 1 }));
    const rec = msgOf(await post(`${M}.feeding.herd_recipes.herd_recipes`, { herd: ctx.feedHerd }));
    const m = msgOf(await post(`${M}.mobile.record_feeding.record_feeding`, { payload: {
      action: "manual", herd: ctx.feedHerd, heads: 2, portion: 0.01, posting_date: today, base_bom: rec.recipes[0].bom_no, lines } }));
    track("Work Order", m.work_order);
    track("Stock Entry", m.transfer_stock_entry);
    track("Stock Entry", m.manufacture_stock_entry);
    return m.work_order;
  });

  // ---- health: see the per-form checks in the app's diagnosis / treatment screens
  await step("write", "health.create_check_up (all fields) + saved values", async () => {
    const sent = {
      animal: F1, operator: op, event_date: today, reason_for_check: "Off her feed since yesterday",
      temperature_c: 39.4, heart_rate: 72, respiration_rate: 28, bcs: 3.25, lameness_score: 2,
      appearance: "Dull", hydration: "Mild dehydration", suggested_disease: "Mastitis",
      differential_notes: "Could be ketosis", action_taken: "Logged — monitor", follow_up_date: today, action_notes: "Recheck tomorrow",
      vet: VET_EXT,
    };
    const m = msgOf(await post(`${M}.health.create_check_up.create_check_up`, { payload: sent }));
    track("Livestock Diagnosis", m.name);
    const doc = await got("Livestock Diagnosis", m.name);
    const { animal, operator, event_date, ...rest } = sent;
    same(doc, { animal, operator, diagnosis_date: event_date, ...rest }, "check-up");
    return m.name;
  });
  await step("write", "health.create_check_up (escalate -> opens file)", async () => {
    const m = msgOf(await post(`${M}.health.create_check_up.create_check_up`, { payload: {
      animal: F3, operator: op, event_date: today, reason_for_check: "Swollen quarter", suggested_disease: "Mastitis",
      action_taken: "Escalated to Case", severity: "Moderate", action_notes: "smoke" } }));
    track("Livestock Diagnosis", m.name);
    if (!m.case) throw new Error("no case opened");
    track("Livestock Health Case", m.case);
    const c = await got("Livestock Health Case", m.case);
    same(c, { animal: F3, provisional_diagnosis: "Mastitis", severity: "Moderate", presenting_symptoms: "Swollen quarter" }, "escalated case");
    ctx.case3 = m.case;
    return m.case;
  });
  await step("write", "health.treat_animal (open new file)", async () => {
    const c = ctx.opts.items_by_event.Treatment?.[0];
    const sent = {
      animal: F1, open_new: true, presenting_symptoms: "Hot hard right hind quarter", provisional_diagnosis: "Mastitis", severity: "Severe",
      operator: op, opened_by: op, vet: VET_INT, treatment_date: today,
      treatments: [{ drug_item: c.value, qty: 2, dosage: "20 ml", route: "IM (Intramuscular)", withdrawal_period_days: 4,
        response_observed: "Improving", administered_by: op, notes: "smoke", source_warehouse: c.warehouse }],
    };
    const m = msgOf(await post(`${M}.health.treat_animal.treat_animal`, { payload: sent }));
    track("Livestock Health Case", m.case);
    if (m.stock_entry) track("Stock Entry", m.stock_entry);
    const doc = await got("Livestock Health Case", m.case);
    same(doc, { animal: F1, presenting_symptoms: sent.presenting_symptoms, provisional_diagnosis: "Mastitis", severity: "Severe", opened_by: op, case_status: "Under Treatment", vet: VET_INT }, "case");
    if (!doc.milk_safe_date) throw new Error("withdrawal date not worked out by the server");
    const t = doc.treatments?.[0];
    same(t, { drug_item: c.value, qty: 2, dosage: "20 ml", route: "IM (Intramuscular)", withdrawal_period_days: 4, response_observed: "Improving", administered_by: op, notes: "smoke", source_warehouse: c.warehouse, treatment_date: today }, "treatment row");
    ctx.case1 = m.case;
    return m.case;
  });
  await step("write", "health.treat_animal (add to the open file)", async () => {
    const c = ctx.opts.items_by_event.Treatment?.[0];
    const m = msgOf(await post(`${M}.health.treat_animal.treat_animal`, { payload: {
      animal: F1, case: ctx.case1, operator: op, treatment_date: today,
      treatments: [{ drug_item: c.value, qty: 1, administered_by: op, source_warehouse: c.warehouse }] } }));
    if (m.treatments !== 2) throw new Error(`file has ${m.treatments} treatments`);
    if (m.stock_entry) track("Stock Entry", m.stock_entry);
  });
  if (VET_EXT) {
    await step("write", "health.treat_animal: an external vet's fee (posts or says why)", async () => {
      const c = ctx.opts.items_by_event.Treatment?.[0];
      const m = msgOf(await post(`${M}.health.treat_animal.treat_animal`, { payload: {
        animal: F1, case: ctx.case1, operator: op, vet: VET_EXT, vet_fee: 900, treatment_date: today,
        treatments: [{ drug_item: c.value, qty: 1, administered_by: op, source_warehouse: c.warehouse }] } }));
      if (m.stock_entry) track("Stock Entry", m.stock_entry);
      if (!m.vet_fee || m.vet_fee.amount !== 900) throw new Error("vet_fee not echoed");
      if (m.vet_fee.journal_entry) track("Journal Entry", m.vet_fee.journal_entry);
      if (VET_POSTS && !m.vet_fee.posted) throw new Error(`fee not posted: ${m.vet_fee.reason}`);
      if (!m.vet_fee.posted && !m.vet_fee.reason) throw new Error("an unposted fee must say why");
      return m.vet_fee.posted ? m.vet_fee.journal_entry : m.vet_fee.reason;
    });
  }
  if (VET_INT) {
    await step("write", "health.treat_animal: an internal vet with a fee is refused", async () => {
      const r = await post(`${M}.health.treat_animal.treat_animal`, { payload: { animal: F1, case: ctx.case1, operator: op, vet: VET_INT, vet_fee: 700, treatment_date: today, treatments: [{ drug_name_text: "smoke", qty: 1, administered_by: op }] } });
      const m = r.data?.message;
      if (!m?.error || !/no vet fee/i.test(m.error)) throw new Error(`unexpected: ${JSON.stringify(m)?.slice(0, 120)}`);
      return m.error.slice(0, 60);
    });
  }
  const uploadPng = async (tag) => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    const form = new FormData();
    form.append("file", new Blob([png], { type: "image/png" }), `smoke-${tag}-${Date.now()}.png`);
    form.append("is_private", "0");
    const up = msgOf(await http("POST", "/api/method/upload_file", { form }));
    track("File", up.name);
    return up.file_url;
  };
  await step("write", "animal_photos: a photo on the open file appears in her gallery", async () => {
    const url = await uploadPng("case");
    const m = msgOf(await post(`${M}.animals.animal_photos.add_animal_photo`, { animal: F1, file_url: url, context: "health_case", ref: ctx.case1, caption: "smoke" }));
    if (m.ref_name !== ctx.case1) throw new Error(`attached to ${m.ref_name}`);
    const g = msgOf(await post(`${M}.animals.animal_photos.animal_gallery`, { animal: F1 }));
    const hit = g.photos.find((p) => p.url === url);
    if (!hit || hit.source !== "Health case" || hit.caption !== "smoke") throw new Error(`gallery: ${JSON.stringify(g.photos).slice(0, 160)}`);
    ctx.photoUrl = url;
    return `${g.photos.length} in gallery`;
  });
  await step("write", "health.close_health_case", async () => {
    const m = msgOf(await post(`${M}.health.close_health_case.close_health_case`, { payload: { case: ctx.case1, case_status: "Recovered", outcome_notes: "smoke", closed_date: today } }));
    const doc = await got("Livestock Health Case", ctx.case1);
    same(doc, { case_status: "Recovered", outcome_notes: "smoke" }, "closed case");
    return m.duration_days;
  });
  await step("write", "animal_photos: a closed case refuses a photo", async () => {
    const url = await uploadPng("closed");
    const r = await post(`${M}.animals.animal_photos.add_animal_photo`, { animal: F1, file_url: url, context: "health_case", ref: ctx.case1 });
    const m = r.data?.message;
    if (!m?.error || !/open/i.test(m.error)) throw new Error(`unexpected: ${JSON.stringify(m)?.slice(0, 120)}`);
    return m.error.slice(0, 60);
  });
  await step("write", "health.create_health_case (blank cow)", async () => {
    const sent = { animal: F2, company: ctx.company, opened_date: today, opened_by: op, presenting_symptoms: "Limping, left fore", body_systems: "Feet / Hooves", provisional_diagnosis: "Lameness - Foot Rot", severity: "Mild", vet: VET_EXT };
    const m = msgOf(await post(`${M}.health.create_health_case.create_health_case`, { payload: sent }));
    track("Livestock Health Case", m.name);
    const doc = await got("Livestock Health Case", m.name);
    same(doc, { animal: F2, presenting_symptoms: sent.presenting_symptoms, body_systems: sent.body_systems, provisional_diagnosis: sent.provisional_diagnosis, severity: "Mild", vet: VET_EXT, opened_by: op }, "health case");
  });
  await step("write", "disposal.record_disposal (Culled (Farm Use))", async () => {
    const m = msgOf(await post(`${M}.disposal.record_disposal.record_disposal`, { payload: { animal: F2, disposal_type: "Culled (Farm Use)", disposal_date: today, reason_details: "smoke", witness: op, vet: VET_EXT } }));
    track("Livestock Disposal", m.name);
    if (VET_EXT) same(await got("Livestock Disposal", m.name), { vet: VET_EXT }, "disposal");
    return m.name;
  });
}

if (WRITE) await writes();

// ---------------------------------------------------------------------------
// WHO MAY RECORD
const NOT_EMP = "You're not registered as an employee, so you can't record. Ask HR to link your user to an Employee.";
const NOT_EMP_MILK = "You're not registered as an employee, so you can't record milkings.";
const isPerm = (t) => /403|not permitted|insufficient permission/i.test(t);

/** Run a read as the session user; a 403 or a "not permitted" answer fails it. */
async function readOk(fn) {
  const r = await fn();
  const text = r.status !== 200 ? `HTTP ${r.status} ${JSON.stringify(r.data)?.slice(0, 200)}` : r.data?.message?.error || "";
  if (r.status !== 200 || r.data?.message?.error) throw new Error(String(text).slice(0, 220));
}

/** The reads every signed-in farm user's app makes, whatever the role. */
function commonReads(who, me) {
  const rd = (name, fn) => step(who, `read ${name}`, () => readOk(fn));
  return Promise.all([]).then(async () => {
    await rd("posting_day", () => get(`${M}.settings.posting_day.posting_day`));
    await rd("get_bootstrap_bundle", () => post(`${M}.mobile.get_bootstrap_bundle.get_bootstrap_bundle`, {}));
    await rd("animals_since", () => get(`${M}.mobile.animals_since.animals_since`));
    await rd("Animal/<name>", () => get(`/api/resource/Animal/${encodeURIComponent(ctx.animal)}`));
    await rd("animal_profile", () => post(`${M}.animals.animal_profile.animal_profile`, { payload: { animal: ctx.animal } }));
    await rd("Livestock Health Case list", () => get("/api/resource/Livestock Health Case", { fields: ["name", "milk_safe_date"], limit_page_length: 1 }));
    await rd("Livestock Event list", () => get("/api/resource/Livestock Event", { fields: ["name", "animal", "event_type", "event_date"], limit_page_length: 5 }));
    await rd("Livestock Settings doc", () => get("/api/resource/Livestock Settings/Livestock Settings"));
    await rd("health_options", () => post(`${M}.health.health_options.health_options`, {}));
    await rd("movement.eligibility", () => post(`${M}.movement.eligibility.eligibility`, {}));
    await rd("employee_options", () => post(`${M}.people.employee_options.employee_options`, { payload: {} }));
  });
}

async function nonEmployee() {
  await step("auth", "non-employee: login", () => login(NONEMP_USER, NONEMP_PASS));
  const who = "non-employee";
  await step(who, "posting_day says is_employee false", async () => {
    const m = msgOf(await get(`${M}.settings.posting_day.posting_day`));
    if (m.is_employee !== false || m.employee) throw new Error(`is_employee ${m.is_employee} employee ${m.employee}`);
  });
  await step(who, "the herd is still readable (animals_since, Animal/<name>)", async () => {
    msgOf(await get(`${M}.mobile.animals_since.animals_since`));
    msgOf(await get(`/api/resource/Animal/${encodeURIComponent(ctx.animal)}`));
  });
  const refused = (name, call, words) =>
    step(who, `${name} is refused`, async () => {
      const m = (await call()).data?.message;
      if (!m?.error) throw new Error(`was accepted: ${JSON.stringify(m)?.slice(0, 120)}`);
      if (m.code !== "not_employee") throw new Error(`refused for another reason: ${m.error}`);
      if (m.error !== words) throw new Error(`wrong words: ${m.error}`);
      track("Livestock Event", m.name); // nothing should exist; tracked defensively
    });
  const t = today;
  await refused("record_milking", () => post(`${M}.mobile.record_milking.record_milking`, { payload: { herd: HERD || "x", milking_time: "05:30", recording_date: t, total_yield_kg: 1, cows_milked: 1 } }), NOT_EMP_MILK);
  for (const [type, extra] of [
    ["Weight Recording", { animal: F1 || ctx.animal, weight_date: t, weight_kg: 400 }],
    ["Heat Detection", { animal: F1 || ctx.animal, event_date: t }],
    ["Service", { animal: F1 || ctx.animal, event_date: t, service_type: "Natural", service_date: t }],
    ["Hoof Trimming", { event_date: t, animals: [F1 || ctx.animal] }],
    ["Movement", { animal: F1 || ctx.animal, event_date: t, new_herd: HERD || "x" }],
  ])
    await refused(`record_animal_event ${type}`, () => post(`${M}.mobile.record_animal_event.record_animal_event`, { payload: { type, ...extra } }), NOT_EMP);
  await refused("create_check_up", () => post(`${M}.health.create_check_up.create_check_up`, { payload: { animal: F1 || ctx.animal, event_date: t, reason_for_check: "smoke", action_taken: "Logged — monitor" } }), NOT_EMP);
  await refused("treat_animal", () => post(`${M}.health.treat_animal.treat_animal`, { payload: { animal: F1 || ctx.animal, open_new: true, presenting_symptoms: "smoke", provisional_diagnosis: "Mastitis", severity: "Mild", treatment_date: t, treatments: [{ drug_name_text: "smoke", qty: 1 }] } }), NOT_EMP);
  await refused("record_feeding manufacture", () => post(`${M}.mobile.record_feeding.record_feeding`, { payload: { action: "manufacture", herd: ctx.feedHerd || "x", portion: 0.01, posting_date: t } }), NOT_EMP);
  await refused("record_disposal", () => post(`${M}.disposal.record_disposal.record_disposal`, { payload: { animal: F1 || ctx.animal, disposal_type: "Culled (Farm Use)", disposal_date: t, reason_details: "smoke" } }), NOT_EMP);
}

/** What each role records: [name, call] pairs. They run only with WRITE=1; without
 *  it the role is only checked for the reads and for not being refused as a
 *  permission (a harmless bad payload). */
function roleWrites(role, op) {
  const ev = (type, payload) => post(`${M}.mobile.record_animal_event.record_animal_event`, { payload: { type, ...payload } });
  const out = {
    "Livestock Milker": [["record_milking", () => post(`${M}.mobile.record_milking.record_milking`, { payload: { herd: HERD, milking_time: "05:30", recording_date: today, total_yield_kg: 20, cows_milked: 2, operator: op, remarks: "smoke role" } }), "Milk Recording"]],
    "Livestock Attendant": [["Weight Recording", () => ev("Weight Recording", { animal: F1, weight_date: today, measured_by: op, weight_kg: 470, remarks: "smoke role" }), "Livestock Weight Record"]],
    "Livestock Breeder": [["Heat Detection", () => ev("Heat Detection", { animal: F3, event_date: today, operator: op, remarks: "smoke role" }), "Livestock Event"]],
    "Livestock Vet": [["create_check_up", () => post(`${M}.health.create_check_up.create_check_up`, { payload: { animal: F1, operator: op, event_date: today, reason_for_check: "smoke role", action_taken: "Logged — monitor" } }), "Livestock Diagnosis"]],
    "Livestock Stores": [["record_feeding manufacture", () => post(`${M}.mobile.record_feeding.record_feeding`, { payload: { action: "manufacture", herd: ctx.feedHerd, portion: 0.01, posting_date: today } }), "Work Order"]],
    "Livestock Manager": [["Heat Detection", () => ev("Heat Detection", { animal: F3, event_date: today, operator: op, remarks: "smoke role" }), "Livestock Event"], ["record_feeding manufacture", () => post(`${M}.mobile.record_feeding.record_feeding`, { payload: { action: "manufacture", herd: ctx.feedHerd, portion: 0.01, posting_date: today } }), "Work Order"]],
  };
  return out[role] || [];
}

async function perRole() {
  for (const [role, cred] of Object.entries(ROLES)) {
    const who = role;
    let op;
    await step("auth", `${role}: login`, () => login(cred.user, cred.password));
    await step(who, "posting_day: Employee linked", async () => {
      const m = msgOf(await get(`${M}.settings.posting_day.posting_day`));
      if (!m.is_employee) throw new Error("test user has no Employee");
      op = m.employee;
    });
    await commonReads(who, op);
    for (const [name, call, doctype] of roleWrites(role, op)) {
      await step(who, `record: ${name}`, async () => {
        const r = await call();
        if (!WRITE) {
          // Not recording: a bad herd/animal is fine, a permission refusal is not.
          const m = r.data?.message;
          if (r.status !== 200 || (m?.error && isPerm(m.error))) throw new Error(`refused: ${JSON.stringify(m?.error ?? r.data)?.slice(0, 200)}`);
          return "not refused as a permission (dry)";
        }
        const m = msgOf(r);
        track(doctype, m.name || m.work_order);
        if (m.transfer_stock_entry) track("Stock Entry", m.transfer_stock_entry);
        if (m.manufacture_stock_entry) track("Stock Entry", m.manufacture_stock_entry);
        if (m.stock_entry) track("Stock Entry", m.stock_entry);
        return m.name || m.work_order;
      });
    }
  }
}

/** The lab role: files quality, and is refused everything else. */
async function qualityUser() {
  const who = "Livestock Quality";
  await step("auth", `${who}: login`, () => login(QUALITY_USER, QUALITY_PASS));
  await step(who, "posting_day tells the phone the role (roles == [Livestock Quality], is_employee)", async () => {
    const m = msgOf(await get(`${M}.settings.posting_day.posting_day`));
    need(m, ["today", "is_employee", "roles"], "posting_day");
    if (JSON.stringify(m.roles) !== JSON.stringify(["Livestock Quality"])) throw new Error(`roles ${JSON.stringify(m.roles)}`);
    if (!m.is_employee) throw new Error("test user has no Employee");
  });
  await step(who, "quality.quality_options (Milk quality segment)", async () => {
    const m = msgOf(await post(`${M}.quality.quality_options.quality_options`, { days: 60 }));
    need(m, ["mode", "required_in_lab", "scc_ceiling", "pending", "recent", "can_write"], "quality_options");
    if (!m.can_write) throw new Error("can_write is false for the quality role");
    return `${m.pending.length} pending, ${m.recent.length} filed`;
  });
  await step(who, "quality.quality_vs_feed (Feed quality segment)", async () => {
    const m = msgOf(await post(`${M}.quality.quality_vs_feed.quality_vs_feed`, { payload: { days: 90 } }));
    need(m, ["days", "from_date", "to_date", "windows", "herds", "weeks"], "quality_vs_feed");
    return `${m.herds.length} herds`;
  });
  const recording = process.env.SMOKE_QUALITY_RECORDING || ctx.milking;
  if (recording) {
    await step(who, "quality.record_milk_quality files lab figures", async () => {
      const m = msgOf(await post(`${M}.quality.record_milk_quality.record_milk_quality`, { payload: { recording, bulk_scc: 180, fat_percent: 3.8, protein_percent: 3.2, lab_test_date: today } }));
      need(m, ["name", "bulk_scc", "fat_percent", "protein_percent", "over_ceiling", "still_pending"], "record_milk_quality");
      if (m.bulk_scc !== 180) throw new Error(`bulk_scc ${m.bulk_scc}`);
      return m.name;
    });
  }
  const refused = (name, call) =>
    step(who, `${name} is refused`, async () => {
      const r = await call();
      const m = r.data?.message;
      if (r.status === 200 && m && !m.error) throw new Error(`was accepted: ${JSON.stringify(m)?.slice(0, 120)}`);
      if (m?.code === "not_employee") throw new Error("refused as not an employee, not by role");
      track("Milk Recording", m?.name);
    });
  await refused("record_milking", () => post(`${M}.mobile.record_milking.record_milking`, { payload: { herd: HERD || "x", milking_time: "05:30", recording_date: today, total_yield_kg: 1, cows_milked: 1 } }));
  await refused("record_animal_event Heat Detection", () => post(`${M}.mobile.record_animal_event.record_animal_event`, { payload: { type: "Heat Detection", animal: F1 || ctx.animal || "x", event_date: today } }));
  await refused("record_feeding manufacture", () => post(`${M}.mobile.record_feeding.record_feeding`, { payload: { action: "manufacture", herd: ctx.feedHerd || "x", portion: 0.01, posting_date: today } }));
}

if (QUALITY_USER && QUALITY_PASS) {
  ctx.animal ||= F1;
  await qualityUser();
}
if (NONEMP_USER && NONEMP_PASS) {
  ctx.animal ||= F1;
  await nonEmployee();
}
if (ROLES) {
  ctx.animal ||= F1;
  ctx.herds ||= [];
  await perRole();
}

// ---------------------------------------------------------------------------
const w = Math.max(...rows.map((r) => r.name.length));
for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(w)}  ${r.note}`);
const bad = rows.filter((r) => !r.ok).length;
console.log(`\n${rows.length - bad}/${rows.length} passed`);
if (created.length) console.log("CREATED " + JSON.stringify(created));
process.exit(bad ? 1 : 0);
