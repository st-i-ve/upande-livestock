import { frappeCreateAndSubmit, todayISO } from "@/src/services/api";

export type DiagnosisAction =
  | "Logged — monitor"
  | "Treated on Spot"
  | "Escalated to Case"
  | "Referred to Vet"
  | "No action — normal";

export type CreateAnimalDiagnosisInput = {
  animal: string;
  operator: string;
  company: string;
  diagnosisDate?: string;
  reasonForCheck?: string;
  appearance?: "Bright & Alert" | "Dull" | "Depressed" | "Down / Recumbent";
  bcs?: number;
  lamenessScore?: number;
  hydration?:
    | "Normal"
    | "Mild dehydration"
    | "Moderate dehydration"
    | "Severe dehydration";
  temperatureC?: number;
  respirationRate?: number;
  heartRate?: number;
  rumenFill?: string;
  differentialNotes?: string;
  suggestedDiagnosis?: string;
  confirmedByVet?: boolean;
  vetName?: string;
  actionTaken: DiagnosisAction;
  actionNotes?: string;
  followUpDate?: string;
};

/**
 * Create + submit an Animal Diagnosis. When `actionTaken` is "Escalated to
 * Case", the server auto-creates a draft Animal Health Case linked back.
 */
export const createAnimalDiagnosis = async (
  input: CreateAnimalDiagnosisInput,
): Promise<any> => {
  const body: Record<string, any> = {
    animal: input.animal,
    operator: input.operator,
    company: input.company,
    diagnosis_date: input.diagnosisDate || todayISO(),
    action_taken: input.actionTaken,
  };
  if (input.reasonForCheck) body.reason_for_check = input.reasonForCheck;
  if (input.appearance) body.appearance = input.appearance;
  if (input.bcs != null) body.bcs = input.bcs;
  if (input.lamenessScore != null) body.lameness_score = input.lamenessScore;
  if (input.hydration) body.hydration = input.hydration;
  if (input.temperatureC != null) body.temperature_c = input.temperatureC;
  if (input.respirationRate != null) body.respiration_rate = input.respirationRate;
  if (input.heartRate != null) body.heart_rate = input.heartRate;
  if (input.rumenFill) body.rumen_fill = input.rumenFill;
  if (input.differentialNotes) body.differential_notes = input.differentialNotes;
  if (input.suggestedDiagnosis) body.suggested_diagnosis = input.suggestedDiagnosis;
  if (input.confirmedByVet) body.confirmed_by_vet = 1;
  if (input.vetName) body.vet_name = input.vetName;
  if (input.actionNotes) body.action_notes = input.actionNotes;
  if (input.followUpDate) body.follow_up_date = input.followUpDate;
  return frappeCreateAndSubmit("Animal Diagnosis", body);
};
