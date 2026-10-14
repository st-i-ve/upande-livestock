import { OpsError } from "./opsError";
import { getClient, todayISO } from "@/src/services/api";

/**
 * Treating an animal — which is also how a health file gets opened.
 *
 * Same door as the web Treatment page: `treat_animal`. It writes the dose into
 * the file she already has, or — only when asked — opens a new one for this
 * illness, and issues the drug out of the store in the same step. Nothing opens
 * a file on its own, which is how one cow came to carry three for one bout of
 * mastitis.
 */
const NS = "/api/method/upande_livestock.serverscripts.health";

export type TreatmentDose = {
  /** Item code of the drug. */
  itemCode: string;
  qty: number;
  warehouse?: string;
  batch?: string;
  /** Free text: "20 ml". */
  dosage?: string;
  /** Livestock Health Treatment.route */
  route?: string;
  withdrawalDays?: number;
  /** Livestock Health Treatment.response_observed */
  response?: string;
};

export type TreatAnimalInput = {
  animal: string;
  /** Name of her open file to add to. Leave blank with `openNew` to start one. */
  caseName?: string;
  openNew?: boolean;
  /** Required when opening a new file. */
  presentingSymptoms?: string;
  provisionalDiagnosis?: string;
  severity?: string;
  /** Employee ID: who gave it, and who opens the file. */
  operator: string;
  treatmentDate?: string;
  doses: TreatmentDose[];
};

export type AnimalCaseStanding = {
  animal: string;
  open_case: {
    name: string;
    opened_date: string | null;
    days_open: number | null;
    treatments: number;
    presenting_symptoms: string | null;
    provisional_diagnosis: string | null;
  } | null;
  history: { name: string; opened_date: string | null; case_status: string }[];
  closed_count: number;
};

/** Her open file, if she has one, and a few closed ones. Asked before treating. */
export const getAnimalCase = async (animal: string): Promise<AnimalCaseStanding> => {
  const client = await getClient();
  const res = await client.post(`${NS}.case_for_animal.case_for_animal`, { payload: { animal } });
  const msg = res.data?.message;
  if (!msg || msg.error) throw new OpsError(msg?.error || "Could not read her health file.");
  return msg as AnimalCaseStanding;
};

export const treatAnimal = async (input: TreatAnimalInput): Promise<any> => {
  const body: Record<string, any> = {
    animal: input.animal,
    case: input.caseName || undefined,
    open_new: input.openNew || undefined,
    presenting_symptoms: input.openNew ? input.presentingSymptoms : undefined,
    provisional_diagnosis: input.openNew ? input.provisionalDiagnosis || undefined : undefined,
    severity: input.openNew ? input.severity || undefined : undefined,
    operator: input.operator,
    opened_by: input.operator,
    treatment_date: input.treatmentDate || todayISO(),
    treatments: input.doses.map((d) => ({
      drug_item: d.itemCode,
      qty: d.qty,
      dosage: d.dosage || undefined,
      route: d.route || undefined,
      withdrawal_period_days: d.withdrawalDays || undefined,
      response_observed: d.response || undefined,
      administered_by: input.operator,
      source_warehouse: d.warehouse || undefined,
      batch_no: d.batch || undefined,
    })),
  };
  const client = await getClient();
  const res = await client.post(`${NS}.treat_animal.treat_animal`, { payload: body });
  const msg = res.data?.message;
  if (!msg) throw new OpsError("treat_animal returned nothing.");
  if (msg.error) throw new OpsError(msg.error);
  return msg;
};
