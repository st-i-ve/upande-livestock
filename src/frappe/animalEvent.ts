import { frappeCreateAndSubmit, todayISO } from "@/src/services/api";
import { listDocuments } from "./generic";

// Event types the Frappe `Animal Event` DocType accepts. Verified against
// the live DocType options on upande-kaitet2.c.frappe.cloud.
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
  | "Heat Detection";

type CommonInput = {
  animal: string;       // Animal name (e.g. "TESTBC-001/26")
  currentHerd: string;  // herd name at time of event
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
      calvingOutcome: "Live Birth" | "Still Birth" | "Abortion";
      toHerd?: string;
      calfBookNumber?: string;
      calfBurnName?: string;
      calfGender?: "Female" | "Male";
      calfTargetHerd?: string;
      birthWeightKg?: number;
      coatColour?: string;
      sire?: string;
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
    }
  | {
      eventType: "Vaccination" | "Deworming" | "Hoof Trimming";
      /** Free-text name of the vet who performed the procedure. */
      vetName: string;
    }
  | {
      eventType: "Dehorning";
      vetName: string;
      /** Employee IDs of farmhands holding the animal. */
      handlerIds?: string[];
    }
  | { eventType: "Heat Detection" };

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
  "custom_animal_ref",
  "event_type",
  "event_date",
  "current_herd",
  "new_herd",
  "custom_to_herd",
  "diagnosis_result",
  "custom_activity_cost",
  "docstatus",
];

const mapEvent = (row: any): EventListRow => ({
  name: row.name,
  animal: row.custom_animal_ref || row.animal,
  eventType: row.event_type,
  eventDate: row.event_date,
  currentHerd: row.current_herd ?? null,
  newHerd: row.new_herd || row.custom_to_herd || null,
  diagnosisResult: row.diagnosis_result ?? null,
  activityCost: Number(row.custom_activity_cost ?? 0),
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
    doctype: "Animal Event",
    fields: EVENT_LIST_FIELDS,
    filters,
    orderBy: "event_date desc",
    limit: params?.limit ?? 200,
  });
  return rows.map(mapEvent);
};

export const createAnimalEvent = async (
  input: AnimalEventInput,
): Promise<any> => {
  const base: Record<string, any> = {
    animal: input.animal,             // Frappe accepts the Animal name here
    custom_animal_ref: input.animal,  // explicitly set the new-module link too
    current_herd: input.currentHerd,
    operator: input.operator,
    event_date: input.eventDate || todayISO(),
    event_type: input.eventType,
  };
  if (input.remarks) base.remarks = input.remarks;

  switch (input.eventType) {
    case "Movement":
      base.new_herd = input.toHerd;
      base.custom_to_herd = input.toHerd;
      break;

    case "Service":
      if (input.serviceType) base.service_type = input.serviceType;
      if (input.semenItem) base.custom_semen_item = input.semenItem;
      if (input.sire) base.sire = input.sire;
      base.service_date = base.event_date;
      break;

    case "Pregnancy Diagnosis":
      base.diagnosis_result = input.diagnosisResult;
      base.diagnosis_date = base.event_date;
      if (input.relatedService) base.related_service = input.relatedService;
      break;

    case "Calving":
    case "Birth":
      base.custom_calving_outcome = input.calvingOutcome;
      base.custom_calf_outcome = input.calvingOutcome;
      if (input.toHerd) {
        base.custom_to_herd = input.toHerd;
      }
      if (input.calfBookNumber) base.custom_calf_book_number = input.calfBookNumber;
      if (input.calfBurnName) base.custom_calf_burn_name = input.calfBurnName;
      if (input.calfGender) base.custom_calf_gender = input.calfGender;
      if (input.calfTargetHerd) base.custom_calf_target_herd = input.calfTargetHerd;
      if (input.birthWeightKg != null) base.custom_birth_weight_kg = input.birthWeightKg;
      if (input.coatColour) base.custom_calf_coat_colour = input.coatColour;
      if (input.sire) base.sire = input.sire;
      break;

    case "Drying Off":
      base.custom_to_herd = input.toHerd;
      if (input.drugIssues?.length) {
        base.custom_drug_issues = input.drugIssues.map(mapDrugIssue);
      }
      break;

    case "Weight Recording":
      base.custom_weight = input.weightKg;
      if (input.bcs != null) base.custom_bcs = input.bcs;
      break;

    case "Vaccination":
    case "Deworming":
    case "Hoof Trimming":
      base.custom_vet_name = input.vetName;
      break;

    case "Dehorning":
      base.custom_vet_name = input.vetName;
      if (input.handlerIds?.length) {
        base.custom_handlers = input.handlerIds.join(", ");
      }
      break;

    case "Heat Detection":
      // Observation only — no specific fields beyond base.
      break;
  }

  return frappeCreateAndSubmit("Animal Event", base);
};
