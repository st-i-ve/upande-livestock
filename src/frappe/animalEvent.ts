import { OpsError } from "./opsError";
import { getClient, todayISO } from "@/src/services/api";
import { listDocuments } from "./generic";
import { discardCalfPhoto, uploadCalfPhoto } from "./calfPhoto";
import { legacyCalf, type CalfInput } from "./calves";
import type { FileAsset } from "./files";

// Event types the `Livestock Event Type` master carries in upande_livestock.
//
// This module used to insert into a doctype called `Animal Event` with a set of
// `custom_*` fieldnames, taken from an older Kaitet site. Neither the doctype
// nor those fields exist in upande_livestock — so every screen routed through
// here failed. Every type now goes to one server endpoint — see RECORD_EVENT
// below — which routes it to whichever module owns it. Those endpoints hold
// the guards, the derived dates, the per-animal fan-out and the named Stock
// Entry types, none of which a raw client-side insert can reproduce.
//
// This list is mirrored in the backend's tests (serverscripts/tests/test_mobile
// APP_EVENT_TYPES). Add a type here and the server test fails until it is
// routed there — deliberately, so a form cannot ship that fails on submit.
export type AnimalEventType =
  | "Movement"
  | "Service"
  | "Pregnancy Diagnosis"
  | "Calving"
  | "Drying Off"
  | "Birth"
  | "Weight Recording"
  | "Vaccination"
  | "Deworming"
  | "Dehorning"
  | "Hoof Trimming"
  | "Heat Detection"
  | "Abortion";

type CommonInput = {
  animal: string;       // Animal name (e.g. "TESTBC-001/26")
  currentHerd: string;  // herd at the time of the event; the server reads it
                        // off the Animal, so this is for labelling only
  operator: string;     // Employee name (e.g. "HR-EMP-01478")
  eventDate?: string;   // ISO date; defaults to today
  remarks?: string;
  /** Livestock Vet id (e.g. "VET-0001") for the health events a vet does. The
   *  server defaults to the logged-in user's vet when it is left out. */
  vet?: string;
};

export type AnimalDrugIssueInput = {
  itemCode: string;
  qty: number;
  uom?: string;
  sourceWarehouse?: string;
  batchNo?: string;
  withdrawalDays?: number;
};

type EventSpecificInput =
  | { eventType: "Movement"; toHerd: string }
  | {
      eventType: "Service";
      serviceType?: "A.I." | "Natural";
      semenItem?: string;
      semenWarehouse?: string;
      sire?: string;
    }
  | {
      eventType: "Pregnancy Diagnosis";
      diagnosisResult: "Confirmed" | "Not Pregnant" | "Aborted";
      relatedService?: string;
    }
  | {
      eventType: "Calving" | "Birth";
      calvingOutcome: "Live Birth" | "Still Birth";
      toHerd?: string;
      /** Every calf of this calving, twins and more. When absent the single-calf
       *  fields below are read instead, which is what an older build queued. */
      calves?: CalfInput[];
      /** @deprecated The server numbers calves; a typed number is ignored. Kept
       *  so a calving queued by an older build still parses. */
      calfBookNumber?: string;
      calfBurnName?: string;
      calfGender?: "Female" | "Male";
      calfTargetHerd?: string;
      birthWeightKg?: number;
      coatColour?: string;
      sire?: string;
      /** Pregnancy Diagnosis this calving answers. The server walks it back to
       *  the service to stamp the sire. */
      relatedPregnancy?: string;
      /** Local file for the calf's picture (optional). Uploaded when the
       *  calving is sent (so, when the offline queue drains) and handed to the
       *  server, which makes it the new calf Animal's image. */
      calfPhoto?: FileAsset;
      calfBreed?: string;
      calfHealthStatus?: "Healthy" | "Weak" | "Needs Attention" | "Critical";
    }
  | {
      eventType: "Drying Off";
      toHerd: string;
      drugIssues?: AnimalDrugIssueInput[];
    }
  | {
      eventType: "Weight Recording";
      weightKg: number;
      bcs?: number;
      weighMethod?: "Weighbridge" | "Platform Scale" | "Heart Girth Tape" | "Visual Estimate";
    }
  | {
      eventType: "Vaccination" | "Deworming" | "Hoof Trimming" | "Dehorning";
      /** The whole round in one call. When set, the server books an event per
       *  animal and one drug issue for the batch. */
      animals?: string[];
      /** Alternative to `animals`: every active animal in this herd. */
      herd?: string;
      /** Drug quantities are PER ANIMAL. */
      drugIssues?: AnimalDrugIssueInput[];
      /** The round's total vet fee. The server records it; the phone posts nothing. */
      vetFee?: number;
      sourceWarehouse?: string;
    }
  | { eventType: "Heat Detection" }
  | {
      /** Pregnancy loss. Its own event type, not a calving outcome — the server
       *  rejects "Abortion" on a Calving and closes the pregnancy from here. */
      eventType: "Abortion";
      abortionCause:
        | "Infectious"
        | "Nutritional"
        | "Traumatic"
        | "Congenital"
        | "Unknown"
        | "Other";
      abortionNotes?: string;
      relatedPregnancy?: string;
    };

export type AnimalEventInput = CommonInput & EventSpecificInput;

/**
 * Build the Frappe payload for an Animal Event and submit it. Server scripts
 * (per references/livestock_server_scripts.md §3) fire on submit and
 * auto-populate downstream fields like Stock Entries, JEs, derived dates,
 * and (for Calving live births) a new Animal record.
 */
export type EventListRow = {
  name: string;
  animal: string;
  eventType: AnimalEventType;
  eventDate: string;
  currentHerd: string | null;
  newHerd: string | null;
  diagnosisResult: string | null;
  activityCost: number;
  /** `custom_is_backdated` — set when the event was entered for a past day. */
  isBackdated: boolean;
  /** `custom_feed_mode` — "System" or "Manual", only ever set on Feeding
   *  events. `null` for every other event type. */
  feedMode: string | null;
};

const EVENT_LIST_FIELDS = [
  "name",
  "animal",
  "event_type",
  "event_date",
  "current_herd",
  "new_herd",
  "diagnosis_result",
  "docstatus",
  "custom_is_backdated",
  "custom_feed_mode",
];

const mapEvent = (row: any): EventListRow => ({
  name: row.name,
  animal: row.animal,
  eventType: row.event_type,
  eventDate: row.event_date,
  currentHerd: row.current_herd ?? null,
  newHerd: row.new_herd ?? null,
  diagnosisResult: row.diagnosis_result ?? null,
  // Livestock Event carries no activity-cost column; the vet fee lives on its
  // own Journal Entry. Reported as 0 rather than dropped, so the reports that
  // sum this field keep their shape.
  activityCost: 0,
  isBackdated: !!row.custom_is_backdated,
  feedMode: row.custom_feed_mode ?? null,
});

export const getRecentEvents = async (params?: {
  eventType?: AnimalEventType;
  since?: string;
  limit?: number;
  animal?: string;
}): Promise<EventListRow[]> => {
  const filters: [string, string, any][] = [["docstatus", "=", 1]];
  if (params?.eventType) filters.push(["event_type", "=", params.eventType]);
  if (params?.since) filters.push(["event_date", ">=", params.since]);
  if (params?.animal) filters.push(["animal", "=", params.animal]);
  const rows = await listDocuments({
    doctype: "Livestock Event",
    fields: EVENT_LIST_FIELDS,
    filters,
    orderBy: "event_date desc",
    limit: params?.limit ?? 200,
  });
  return rows.map(mapEvent);
};

// One path, and it does not move. This used to name the backend module that
// owned each event type — and when the server reorganised its endpoints, every
// write this app made became a 404. A handset in the field cannot be
// force-updated, so the routing lives on the server now: post the type with the
// payload and it goes wherever that type is owned.
const RECORD_EVENT = "upande_livestock.serverscripts.mobile.record_animal_event";

/** POST an event to the mobile entry point and unwrap its `{ok, ...}` reply. */
const callOp = async (type: string, payload: Record<string, any>): Promise<any> => {
  const client = await getClient();
  const res = await client.post(`/api/method/${RECORD_EVENT}.record_animal_event`, {
    payload: { type, ...payload },
  });
  const msg = res.data?.message;
  if (!msg) throw new OpsError(`${type} returned nothing.`);
  if (msg.error) throw new OpsError(msg.error, msg.code);
  return msg;
};

const mapDrugRows = (rows?: AnimalDrugIssueInput[]) =>
  (rows ?? [])
    .filter((d) => d.itemCode && Number(d.qty) > 0)
    .map((d) => ({
      item_code: d.itemCode,
      // PER ANIMAL. create_husbandry_event multiplies by the animal count and
      // posts one issue for the round — 2 ml a cow across 119 cows leaves the
      // store as a single 238 ml line.
      qty: Number(d.qty),
      uom: d.uom,
      source_warehouse: d.sourceWarehouse,
      batch_no: d.batchNo,
      withdrawal_days: d.withdrawalDays,
    }));

/** Fold detail the Livestock Event has no column for into the remarks, so the
 *  fact is still on the record rather than silently dropped on the floor. */
const withNote = (remarks: string | undefined, ...notes: (string | undefined)[]) =>
  [remarks, ...notes.filter((n) => n && n.trim())].filter(Boolean).join(" · ") || undefined;

/**
 * Record one livestock event through the endpoint that owns its type.
 *
 * Returns whatever that endpoint returns — always `{ok: true, name, ...}`.
 * For a live birth the reply also carries `calves[]`, each with the created
 * `animal` name; that is what the calving screen attaches the calf photo to.
 */
export const createAnimalEvent = async (
  input: AnimalEventInput,
): Promise<any> => {
  const common = {
    animal: input.animal,
    event_date: input.eventDate || todayISO(),
    operator: input.operator,
    remarks: input.remarks,
    vet: input.vet || undefined,
  };

  switch (input.eventType) {
    case "Movement":
      return callOp("Movement", { ...common, new_herd: input.toHerd });

    case "Service":
      return callOp("Service", {
        ...common,
        service_type: input.serviceType,
        service_date: common.event_date,
        sire: input.sire,
        // What the straw used is a stock line, sent only when the screen showed
        // one (the Service event type posts stock). The server issues it as the
        // named Stock Entry "Livestock Service", one per event, from this store
        // or the event type's default store when blank.
        items: input.semenItem
          ? [{ item_code: input.semenItem, qty: 1, source_warehouse: input.semenWarehouse || undefined }]
          : undefined,
      });

    case "Pregnancy Diagnosis":
      return callOp("Pregnancy Diagnosis", {
        ...common,
        diagnosis_date: common.event_date,
        diagnosis_result: input.diagnosisResult,
        related_service: input.relatedService,
        diagnosis_remarks: input.remarks,
      });

    case "Calving":
    case "Birth": {
      // record_birth books the Calving on the dam and creates one Animal per
      // calf. `animal` here is the dam — the calf does not exist yet.
      const wholeStillbirth = input.calvingOutcome !== "Live Birth";
      const calves: CalfInput[] = input.calves?.length ? input.calves : [legacyCalf(input)];
      // Upload first, so one server call carries the calving and every photo.
      // A network failure rethrows — nothing is recorded yet, so the queue can
      // safely retry the whole item. Any other failure (the file is gone, the
      // server refused it) drops that photo, not the birth.
      let photo: "attached" | "failed" | "none" = "none";
      const rows: Record<string, unknown>[] = [];
      for (const c of calves) {
        const dead = wholeStillbirth || !!c.isStillborn;
        let photoUrl: string | undefined;
        if (!dead && c.photo) {
          try {
            photoUrl = await uploadCalfPhoto(c.photo);
            if (photo !== "failed") photo = "attached";
          } catch (e) {
            if (!(e as any)?.response) throw e;
            photo = "failed";
          }
        }
        rows.push({
          // No number is sent: the server numbers every live calf (A for a
          // heifer, B for a bull). A blank name is NOT a stillbirth;
          // is_stillborn says so explicitly.
          sex: c.sex,
          burn_name: c.burnName?.trim() || undefined,
          birth_weight: c.birthWeightKg,
          herd: c.herd || undefined,
          breed: c.breed,
          health_status: c.healthStatus,
          is_stillborn: dead ? 1 : 0,
          photo: photoUrl,
        });
      }
      const coats = calves
        .map((c, i) => (c.coatColour?.trim() ? `${calves.length > 1 ? `Calf ${i + 1} ` : ""}Coat: ${c.coatColour.trim()}` : undefined));
      const reply = await callOp(input.eventType, {
        dam: input.animal,
        event_date: common.event_date,
        operator: input.operator,
        outcome: input.calvingOutcome,
        related_pregnancy: input.relatedPregnancy,
        remarks: withNote(input.remarks, ...coats),
        calves: rows,
      });
      // The calving is recorded: the durable copy has done its job.
      for (const c of calves) if (c.photo) discardCalfPhoto(c.photo.uri);
      return { ...reply, photo };
    }

    case "Drying Off":
      return callOp("Drying Off", {
        ...common,
        new_herd: input.toHerd,
        drugs: mapDrugRows(input.drugIssues),
      });

    case "Weight Recording":
      // Not a Livestock Event at all — weighings are their own doctype, which
      // owns the previous-weight / daily-gain columns and the interval guard.
      return callOp("Weight Recording", {
        animal: input.animal,
        weight_date: common.event_date,
        measured_by: input.operator,
        weight_kg: input.weightKg,
        bcs: input.bcs,
        method: input.weighMethod,
        remarks: input.remarks,
      });

    case "Vaccination":
    case "Deworming":
    case "Hoof Trimming":
    case "Dehorning":
      // One call for the whole round: the endpoint fans out an event per animal
      // and posts a single issue out of the drug store, stamped with the named
      // Stock Entry Type ("Vaccination", "Deworming") rather than the bare
      // "Material Issue".
      return callOp(input.eventType, {
        event_date: common.event_date,
        operator: input.operator,
        vet: input.vet || undefined,
        animals: input.animals?.length ? input.animals : [input.animal],
        herd: input.herd,
        drugs: mapDrugRows(input.drugIssues),
        vet_fee: input.vetFee,
        source_warehouse: input.sourceWarehouse,
        remarks: input.remarks,
      });

    case "Heat Detection":
      return callOp("Heat Detection", common);

    case "Abortion":
      return callOp("Abortion", {
        ...common,
        abortion_cause: input.abortionCause,
        abortion_notes: input.abortionNotes,
        related_pregnancy: input.relatedPregnancy,
      });
  }
};
