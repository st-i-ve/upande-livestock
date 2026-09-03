import { OpsError } from "./opsError";
import { getClient, todayISO } from "@/src/services/api";
import { listDocuments } from "./generic";

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
};

export type AnimalDrugIssueInput = {
  itemCode: string;
  qty: number;
  uom?: string;
  sourceWarehouse?: string;
  withdrawalDays?: number;
  milkSafeDate?: string;
};

type EventSpecificInput =
  | { eventType: "Movement"; toHerd: string }
  | {
      eventType: "Service";
      serviceType?: "A.I." | "Natural";
      semenItem?: string;
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
      /** Free-text name of the vet who performed the procedure. Livestock Event
       *  has no column for it, so it is folded into the remarks. */
      vetName: string;
      /** The whole round in one call. When set, the server books an event per
       *  animal and one drug issue for the batch. */
      animals?: string[];
      /** Alternative to `animals`: every active animal in this herd. */
      herd?: string;
      /** Drug quantities are PER ANIMAL. */
      drugIssues?: AnimalDrugIssueInput[];
      sourceWarehouse?: string;
      /** Employee IDs of farmhands holding the animal (Dehorning). */
      handlerIds?: string[];
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

const mapDrugIssue = (d: AnimalDrugIssueInput) => ({
  item_code: d.itemCode,
  qty: d.qty,
  uom: d.uom,
  source_warehouse: d.sourceWarehouse,
  withdrawal_days: d.withdrawalDays,
  milk_safe_date: d.milkSafeDate,
});

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
});

export const getRecentEvents = async (params?: {
  eventType?: AnimalEventType;
  since?: string;
  limit?: number;
}): Promise<EventListRow[]> => {
  const filters: [string, string, any][] = [["docstatus", "=", 1]];
  if (params?.eventType) filters.push(["event_type", "=", params.eventType]);
  if (params?.since) filters.push(["event_date", ">=", params.since]);
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
  if (msg.error) throw new OpsError(msg.error);
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
      withdrawal_days: d.withdrawalDays,
      milk_safe_date: d.milkSafeDate,
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
        semen_item: input.semenItem,
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
      const stillborn = input.calvingOutcome !== "Live Birth";
      return callOp(input.eventType, {
        dam: input.animal,
        event_date: common.event_date,
        operator: input.operator,
        outcome: input.calvingOutcome,
        related_pregnancy: input.relatedPregnancy,
        remarks: withNote(
          input.remarks,
          input.coatColour ? `Coat: ${input.coatColour}` : undefined,
        ),
        calves: [
          {
            // _calf_row treats an empty/"STILLBORN" tag as stillborn, so a
            // still birth needs no tag and a live birth must carry one.
            name: stillborn ? "" : (input.calfBookNumber || "").trim(),
            sex: input.calfGender,
            birth_weight: input.birthWeightKg,
            herd: input.calfTargetHerd,
            breed: input.calfBreed,
            health_status: input.calfHealthStatus,
          },
        ],
      });
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
        animals: input.animals?.length ? input.animals : [input.animal],
        herd: input.herd,
        drugs: mapDrugRows(input.drugIssues),
        source_warehouse: input.sourceWarehouse,
        remarks: withNote(
          input.remarks,
          input.vetName ? `Vet: ${input.vetName}` : undefined,
          input.handlerIds?.length ? `Handlers: ${input.handlerIds.join(", ")}` : undefined,
        ),
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
