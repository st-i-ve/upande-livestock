import { OpsError } from "./opsError";
import { getClient, todayISO } from "@/src/services/api";
import { listDocuments } from "./generic";

export type DiagnosisAction =
  | "Logged — monitor"
  | "Treated on Spot"
  | "Escalated to Case"
  | "Referred to Vet"
  | "No action — normal";

/** One row of the Animal Diagnosis `system_checks` child table. */
export type SystemCheckInput = {
  bodySystem: string;
  finding: string;
  severity?: "Mild" | "Moderate" | "Severe";
};

export type CreateAnimalDiagnosisInput = {
  animal: string;
  operator: string;
  company: string;
  diagnosisDate?: string;
  reasonForCheck?: string;
  systemChecks?: SystemCheckInput[];
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
  /** Drugs given at the check-up. Issued as one "Animal Health Check" entry. */
  drugIssues?: {
    itemCode: string;
    qty: number;
    uom?: string;
    sourceWarehouse?: string;
    withdrawalDays?: number;
  }[];
};

/**
 * Create + submit an Animal Diagnosis. When `actionTaken` is "Escalated to
 * Case", the server auto-creates a draft Animal Health Case linked back.
 */
export type DiagnosisListRow = {
  name: string;
  animal: string;
  animalName: string;
  diagnosisDate: string;
  actionTaken: DiagnosisAction;
  suggestedDiagnosis: string | null;
  followUpDate: string | null;
  relatedCase: string | null;
};

const DIAGNOSIS_LIST_FIELDS = [
  "name",
  "animal",
  "animal_name",
  "diagnosis_date",
  "action_taken",
  "suggested_disease",
  "follow_up_date",
  "related_case",
];

const mapDiagnosis = (row: any): DiagnosisListRow => ({
  name: row.name,
  animal: row.animal,
  animalName: row.animal_name || row.animal,
  diagnosisDate: row.diagnosis_date,
  actionTaken: row.action_taken,
  suggestedDiagnosis: row.suggested_disease ?? null,
  followUpDate: row.follow_up_date ?? null,
  relatedCase: row.related_case ?? null,
});

export const getDiagnoses = async (limit = 100): Promise<DiagnosisListRow[]> => {
  const rows = await listDocuments({
    doctype: "Livestock Diagnosis",
    fields: DIAGNOSIS_LIST_FIELDS,
    orderBy: "diagnosis_date desc",
    limit,
  });
  return rows.map(mapDiagnosis);
};

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
  if (input.systemChecks?.length) {
    body.system_checks = input.systemChecks.map((c) => ({
      body_system: c.bodySystem,
      finding: c.finding,
      severity: c.severity,
    }));
  }
  if (input.appearance) body.appearance = input.appearance;
  if (input.bcs != null) body.bcs = input.bcs;
  if (input.lamenessScore != null) body.lameness_score = input.lamenessScore;
  if (input.hydration) body.hydration = input.hydration;
  if (input.temperatureC != null) body.temperature_c = input.temperatureC;
  if (input.respirationRate != null) body.respiration_rate = input.respirationRate;
  if (input.heartRate != null) body.heart_rate = input.heartRate;
  if (input.rumenFill) body.rumen_fill = input.rumenFill;
  if (input.differentialNotes) body.differential_notes = input.differentialNotes;
  // The field is `suggested_disease` and it Links to Livestock Disease.
  if (input.suggestedDiagnosis) body.suggested_disease = input.suggestedDiagnosis;
  if (input.confirmedByVet) body.confirmed_by_vet = 1;
  if (input.vetName) body.vet_name = input.vetName;
  if (input.actionNotes) body.action_notes = input.actionNotes;
  if (input.followUpDate) body.follow_up_date = input.followUpDate;
  if (input.drugIssues?.length) {
    body.drugs = input.drugIssues.map((d) => ({
      item_code: d.itemCode,
      qty: d.qty,
      uom: d.uom,
      source_warehouse: d.sourceWarehouse,
      withdrawal_days: d.withdrawalDays,
    }));
  }

  // create_check_up owns the doctype: it resolves the company and operator,
  // enforces the guards, and posts any drug rows as one issue stamped
  // "Animal Health Check" rather than a bare Material Issue.
  const client = await getClient();
  const res = await client.post(
    "/api/method/upande_livestock.api.operations.create_check_up",
    { payload: body },
  );
  const msg = res.data?.message;
  if (!msg) throw new OpsError("create_check_up returned nothing.");
  if (msg.error) throw new OpsError(msg.error);
  return msg;
};
