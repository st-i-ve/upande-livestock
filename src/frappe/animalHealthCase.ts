import { frappeCreateAndSubmit, getClient, todayISO } from "@/src/services/api";
import { countDocuments, getDocument, listDocuments } from "./generic";

export type CaseStatus =
  | "Open"
  | "Under Treatment"
  | "Recovered"
  | "Chronic"
  | "Died"
  | "Culled";

export type CaseSeverity = "Mild" | "Moderate" | "Severe" | "Critical";

export type HealthTreatmentInput = {
  /** Treatment date — ISO. Defaults to the case's opened_date on submit. */
  treatmentDate?: string;
  /** Frappe Item code (Link). The Stock Entry created by the server uses
   *  this + source_warehouse to issue stock. */
  itemCode: string;
  itemName?: string;
  qty: number;
  uom?: string;
  /** Per-unit cost. Usually auto-filled from Item.last_purchase_rate. */
  rate?: number;
  /** Optional override; otherwise qty × rate. */
  amount?: number;
  sourceWarehouse: string;
  withdrawalDays?: number;
  /** Free text: "Procaine Penicillin 20 ml IM" etc. */
  description?: string;
  administeredBy?: string;
  remarks?: string;
};

export type CreateAnimalHealthCaseInput = {
  animal: string;
  company: string;
  openedBy?: string;              // Employee name
  openedDate?: string;            // ISO; default today
  caseStatus?: CaseStatus;        // defaults to "Open"
  presentingSymptoms: string;
  bodySystems?: string;
  provisionalDiagnosis?: string;  // Animal Disease name
  severity?: CaseSeverity;
  vetCalled?: boolean;
  vetName?: string;
  vetVisitDate?: string;
  /** Initial treatment log — issued to the case's `treatments` child table.
   *  The After-Submit server script creates the drug Stock Entry + cost JE
   *  from these rows. */
  treatments?: HealthTreatmentInput[];
};

/**
 * Maps a Treatment input to the Frappe child-row shape. We send the union
 * of field names we believe the Animal Health Treatment doctype carries
 * — unknown fields are silently ignored by Frappe on insert, so the cost
 * of being over-permissive here is zero.
 */
const mapTreatment = (t: HealthTreatmentInput) => {
  const qty = Number(t.qty) || 0;
  const rate = Number(t.rate ?? 0);
  const amount = Number(t.amount ?? qty * rate) || 0;
  return {
    treatment_date: t.treatmentDate,
    item_code: t.itemCode,
    item_name: t.itemName,
    qty,
    uom: t.uom,
    stock_uom: t.uom,
    rate,
    amount,
    source_warehouse: t.sourceWarehouse,
    withdrawal_days: t.withdrawalDays,
    description: t.description,
    administered_by: t.administeredBy,
    remarks: t.remarks,
  };
};

export type HealthCaseListRow = {
  name: string;
  animal: string;
  animalName: string;
  caseStatus: CaseStatus;
  severity: CaseSeverity | null;
  openedDate: string;
  presentingSymptoms: string;
  totalTreatmentCost: number;
  duration: number | null;
};

const mapCase = (row: any): HealthCaseListRow => ({
  name: row.name,
  animal: row.animal,
  animalName: row.animal_name || row.animal,
  caseStatus: row.case_status,
  severity: row.severity ?? null,
  openedDate: row.opened_date,
  presentingSymptoms: row.presenting_symptoms ?? "",
  totalTreatmentCost: Number(row.total_treatment_cost ?? 0),
  duration: row.duration_days ?? null,
});

const HEALTH_CASE_LIST_FIELDS = [
  "name",
  "animal",
  "animal_name",
  "case_status",
  "severity",
  "opened_date",
  "presenting_symptoms",
  "total_treatment_cost",
  "duration_days",
];

export const getHealthCases = async (
  filters: ["case_status" | "any", string][] = [],
): Promise<HealthCaseListRow[]> => {
  const f: [string, string, any][] = filters
    .filter(([k]) => k !== "any")
    .map(([k, v]) => [k, "=", v] as [string, string, any]);
  const rows = await listDocuments({
    doctype: "Animal Health Case",
    fields: HEALTH_CASE_LIST_FIELDS,
    filters: f,
    orderBy: "opened_date desc",
    limit: 200,
  });
  return rows.map(mapCase);
};

export const countOpenHealthCases = (): Promise<number> =>
  countDocuments("Animal Health Case", [["case_status", "in", ["Open", "Under Treatment"]]]);

export const createAnimalHealthCase = async (
  input: CreateAnimalHealthCaseInput,
): Promise<any> => {
  const body: Record<string, any> = {
    animal: input.animal,
    company: input.company,
    opened_date: input.openedDate || todayISO(),
    case_status: input.caseStatus || "Open",
    presenting_symptoms: input.presentingSymptoms,
  };
  if (input.openedBy) body.opened_by = input.openedBy;
  if (input.bodySystems) body.body_systems = input.bodySystems;
  if (input.provisionalDiagnosis) body.provisional_diagnosis = input.provisionalDiagnosis;
  if (input.severity) body.severity = input.severity;
  if (input.vetCalled) body.vet_called = 1;
  if (input.vetName) body.vet_name = input.vetName;
  if (input.vetVisitDate) body.vet_visit_date = input.vetVisitDate;
  if (input.treatments && input.treatments.length > 0) {
    body.treatments = input.treatments.map(mapTreatment);
  }
  return frappeCreateAndSubmit("Animal Health Case", body);
};

// ---------------------------------------------------------------------------
// Update path — used to close a case with an outcome.

export type UpdateAnimalHealthCaseInput = {
  /** Frappe doc name of the existing case. */
  name: string;
  /** New status. Only the closing-statuses make sense here. */
  caseStatus: "Recovered" | "Chronic" | "Died";
  closingNotes?: string;
  closingDate?: string;
};

export async function updateAnimalHealthCase(
  input: UpdateAnimalHealthCaseInput,
): Promise<any> {
  const client = await getClient();
  const body: Record<string, any> = {
    case_status: input.caseStatus,
  };
  if (input.closingNotes) body.closing_notes = input.closingNotes;
  if (input.closingDate) body.closing_date = input.closingDate;
  const res = await client.put(
    `/api/resource/Animal Health Case/${encodeURIComponent(input.name)}`,
    body,
  );
  return res.data?.data;
}

export type AnimalHealthCaseDetail = {
  name: string;
  animal: string;
  animalName: string;
  caseStatus: CaseStatus;
  severity: CaseSeverity | null;
  openedDate: string;
  closingDate: string | null;
  closingNotes: string | null;
  presentingSymptoms: string;
  totalTreatmentCost: number;
  treatments: {
    treatmentDate: string;
    itemCode: string;
    itemName: string;
    qty: number;
    uom: string;
    rate: number;
    amount: number;
  }[];
};

export async function getAnimalHealthCase(name: string): Promise<AnimalHealthCaseDetail | null> {
  const row = await getDocument<any>("Animal Health Case", name);
  if (!row) return null;
  return {
    name: row.name,
    animal: row.animal,
    animalName: row.animal_name || row.animal,
    caseStatus: row.case_status,
    severity: row.severity ?? null,
    openedDate: row.opened_date,
    closingDate: row.closing_date ?? null,
    closingNotes: row.closing_notes ?? null,
    presentingSymptoms: row.presenting_symptoms ?? "",
    totalTreatmentCost: Number(row.total_treatment_cost ?? 0),
    treatments: Array.isArray(row.treatments)
      ? row.treatments.map((t: any) => ({
          treatmentDate: t.treatment_date ?? "",
          itemCode: t.item_code,
          itemName: t.item_name || t.item_code,
          qty: Number(t.qty ?? 0),
          uom: t.uom || "",
          rate: Number(t.rate ?? 0),
          amount: Number(t.amount ?? Number(t.qty ?? 0) * Number(t.rate ?? 0)),
        }))
      : [],
  };
}
