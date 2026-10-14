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
 * Point it at a development site only.
 */
const URL_ = process.env.LIVESTOCK_URL;
const USER = process.env.LIVESTOCK_USER;
const PASS = process.env.LIVESTOCK_PASSWORD;
const WRITE = process.env.WRITE === "1";
const [F1, F2, F3] = (process.env.SMOKE_ANIMALS || "").split(",");
const HERD = process.env.SMOKE_HERD;
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
await step("auth", "POST /api/method/login", async () => {
  const body = new URLSearchParams({ usr: USER, pwd: PASS });
  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  const res = await fetch(URL_ + "/api/method/login", { method: "POST", headers, body });
  cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const j = await res.json();
  if (res.status !== 200 || !cookie) throw new Error(`login ${res.status} ${JSON.stringify(j)}`);
  return j.full_name;
});
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
const ANIMAL_FIELDS = ["name", "burn_name", "sex", "date_of_birth", "current_herd", "repro_status", "parity", "last_weight_kg"];
await step("read", "GET Animal list (useAnimals)", async () => {
  const m = msgOf(await get("/api/resource/Animal", {
    fields: ANIMAL_FIELDS, filters: [["disabled", "=", 0]], limit_page_length: 1000, order_by: "name asc",
  }));
  need(m[0], ANIMAL_FIELDS, "animal row");
  ctx.animal = m[0].name;
  return `${m.length} animals`;
});
await step("read", "GET Animal/<name> (useAnimal)", async () => {
  const m = msgOf(await get(`/api/resource/Animal/${encodeURIComponent(ctx.animal)}`));
  need(m, ["name", "sex", "status"], "animal doc"); // null fields (dam, sire_name...) are simply absent
});
await step("read", "animals.animal_profile (days in milk)", async () => {
  const m = msgOf(await post(`${M}.animals.animal_profile.animal_profile`, { payload: { animal: ctx.animal } }));
  need(m.cycle, ["daysInMilk"], "cycle");
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
await step("read", "GET Employee by user (useOperator)", async () => {
  const m = msgOf(await get("/api/resource/Employee", {
    fields: ["name", "employee_name", "user_id"], filters: [["user_id", "=", USER]], limit_page_length: 1,
  }));
  if (!m[0]) throw new Error("no Employee linked to this user");
  ctx.employee = m[0].name;
  return m[0].name;
});
await step("read", "GET Employee search (useEmployees)", async () => {
  const m = msgOf(await get("/api/resource/Employee", {
    fields: ["name", "employee_name", "user_id"], filters: [["status", "=", "Active"], ["employee_name", "like", "%a%"]],
    limit_page_length: 20, order_by: "employee_name asc",
  }));
  return `${m.length} rows`;
});
await step("read", "GET Employee/<name>", async () => {
  need(msgOf(await get(`/api/resource/Employee/${encodeURIComponent(ctx.employee)}`)), ["employee_name"], "employee");
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
await step("read", "health.health_options (useEventItems)", async () => {
  const m = msgOf(await post(`${M}.health.health_options.health_options`, {}));
  need(m, ["items_by_event", "diseases", "appearances", "hydrations", "actions", "severities", "routes", "responses", "employee", "company"], "options");
  ctx.opts = m;
});
await step("read", "GET Item search (feeding: add an ingredient)", async () => {
  msgOf(await get("/api/resource/Item", { fields: ["name", "item_name", "item_code", "stock_uom"], filters: [["disabled", "=", 0], ["is_stock_item", "=", 1], ["item_name", "like", "%a%"]], limit_page_length: 30 }));
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
  await step("write", "Heat Detection", async () => (await ev("Heat Detection", { animal: F3, event_date: today, operator: op, remarks: "smoke" })).name);
  await step("write", "Service", async () => {
    const m = await ev("Service", { animal: F1, event_date: today, operator: op, service_type: "A.I.", service_date: today, semen_item: sem?.value, semen_warehouse: sem?.warehouse, sire: "SMOKE SIRE", remarks: "smoke" });
    ctx.service1 = m.name;
    return m.name;
  });
  await step("write", "Service (second cow, for the abortion)", async () => {
    const m = await ev("Service", { animal: F2, event_date: today, operator: op, service_type: "Natural", service_date: today, remarks: "smoke" });
    ctx.service2 = m.name;
    return m.name;
  });
  await step("write", "Pregnancy Diagnosis (Confirmed)", async () => {
    const m = await ev("Pregnancy Diagnosis", { animal: F1, event_date: today, operator: op, diagnosis_date: today, diagnosis_result: "Confirmed", related_service: ctx.service1, diagnosis_remarks: "smoke" });
    ctx.pd1 = m.name;
    return m.name;
  });
  await step("write", "Pregnancy Diagnosis (second cow)", async () => {
    const m = await ev("Pregnancy Diagnosis", { animal: F2, event_date: today, operator: op, diagnosis_date: today, diagnosis_result: "Confirmed", related_service: ctx.service2 });
    ctx.pd2 = m.name;
  });
  await step("write", "Abortion", async () => (await ev("Abortion", { animal: F2, event_date: today, operator: op, abortion_cause: "Unknown", abortion_notes: "smoke" })).name); // the app sends no related_pregnancy; the server finds the open one
  await step("write", "Drying Off", async () => {
    const d = drug();
    return (await ev("Drying Off", { animal: F1, event_date: today, operator: op, new_herd: ctx.elig.next_herd?.[HERD] || ctx.herds.find((h) => h.is_dry)?.name || ctx.herds[0].name, drugs: d ? [d] : [], remarks: "smoke" })).name;
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
    const tag = `ZSMOKE-C${Date.now() % 100000}`;
    const m = await ev("Calving", {
      dam: F1, event_date: today, operator: op, outcome: "Live Birth", remarks: "smoke · Coat: Black",
      calves: [{ name: tag, sex: "Female", birth_weight: 32, herd: ctx.elig.calf_herds.female || ctx.herds[0].name, breed: undefined, health_status: "Healthy", photo: up.file_url }],
    });
    need(m, ["calves"], "birth reply");
    const calf = m.calves[0].animal;
    track("Animal", calf);
    const doc = await got("Animal", calf);
    if (doc.image !== up.file_url) throw new Error(`calf image ${doc.image} != ${up.file_url}`);
    return `${calf} image ok`;
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
      const m = await ev(t, { event_date: today, operator: op, animals: t === "Dehorning" ? [F3] : [F1, F3], drugs: d ? [{ ...d, withdrawal_days: 2 }] : [], vet_fee: 1500, remarks: `smoke ${t}` });
      if (!m.vet_fee || m.vet_fee.amount !== 1500) throw new Error("vet_fee not echoed");
      const doc = await got("Livestock Event", m.name);
      same(doc, { event_type: t, operator: op, event_date: today }, `${t} event`);
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
  await step("write", "mobile.record_milking", async () => {
    const m = msgOf(await post(`${M}.mobile.record_milking.record_milking`, { payload: {
      herd: HERD, milking_time: "05:30", recording_date: today, total_yield_kg: 120, discarded_kg: 5, net_yield_kg: 115,
      discard_reason: "Mastitis", cows_milked: 10, operator: op, remarks: "smoke" } }));
    track("Milk Recording", m.name);
    const doc = await got("Milk Recording", m.name);
    same(doc, { herd: HERD, total_yield_kg: 120, discarded_kg: 5, cows_milked: 10 }, "milk recording");
    return m.name;
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
      operator: op, opened_by: op, treatment_date: today,
      treatments: [{ drug_item: c.value, qty: 2, dosage: "20 ml", route: "IM (Intramuscular)", withdrawal_period_days: 4,
        response_observed: "Improving", administered_by: op, notes: "smoke", source_warehouse: c.warehouse }],
    };
    const m = msgOf(await post(`${M}.health.treat_animal.treat_animal`, { payload: sent }));
    track("Livestock Health Case", m.case);
    if (m.stock_entry) track("Stock Entry", m.stock_entry);
    const doc = await got("Livestock Health Case", m.case);
    same(doc, { animal: F1, presenting_symptoms: sent.presenting_symptoms, provisional_diagnosis: "Mastitis", severity: "Severe", opened_by: op, case_status: "Under Treatment" }, "case");
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
  await step("write", "health.close_health_case", async () => {
    const m = msgOf(await post(`${M}.health.close_health_case.close_health_case`, { payload: { case: ctx.case1, case_status: "Recovered", outcome_notes: "smoke", closed_date: today } }));
    const doc = await got("Livestock Health Case", ctx.case1);
    same(doc, { case_status: "Recovered", outcome_notes: "smoke" }, "closed case");
    return m.duration_days;
  });
  await step("write", "health.create_health_case (blank cow)", async () => {
    const sent = { animal: F2, company: ctx.company, opened_date: today, opened_by: op, presenting_symptoms: "Limping, left fore", body_systems: "Feet / Hooves", provisional_diagnosis: "Lameness - Foot Rot", severity: "Mild", vet_called: true, vet_name: "Dr. Mwangi" };
    const m = msgOf(await post(`${M}.health.create_health_case.create_health_case`, { payload: sent }));
    track("Livestock Health Case", m.name);
    const doc = await got("Livestock Health Case", m.name);
    same(doc, { animal: F2, presenting_symptoms: sent.presenting_symptoms, body_systems: sent.body_systems, provisional_diagnosis: sent.provisional_diagnosis, severity: "Mild", vet_called: 1, vet_name: "Dr. Mwangi", opened_by: op }, "health case");
  });
  await step("write", "disposal.record_disposal (Culled (Farm Use))", async () => {
    const m = msgOf(await post(`${M}.disposal.record_disposal.record_disposal`, { payload: { animal: F2, disposal_type: "Culled (Farm Use)", disposal_date: today, reason_details: "smoke", witness: op } }));
    track("Livestock Disposal", m.name);
    return m.name;
  });
}

if (WRITE) await writes();

// ---------------------------------------------------------------------------
const w = Math.max(...rows.map((r) => r.name.length));
for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(w)}  ${r.note}`);
const bad = rows.filter((r) => !r.ok).length;
console.log(`\n${rows.length - bad}/${rows.length} passed`);
if (created.length) console.log("CREATED " + JSON.stringify(created));
process.exit(bad ? 1 : 0);
