import { frappeCreateAndSubmit, todayISO } from "@/src/services/api";
import { countDocuments, listDocuments } from "./generic";

export type CaseStatus =
  | "Open"
  | "Under Treatment"
  | "Recovered"
  | "Chronic"
  | "Died"
  | "Culled";

export type CaseSeverity = "Mild" | "Moderate" | "Severe" | "Critical";

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
  return frappeCreateAndSubmit("Animal Health Case", body);
};
