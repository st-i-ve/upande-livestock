import { frappeCreateAndSubmit, todayISO } from "@/src/services/api";

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
