import { OpsError } from "./opsError";
import { getClient, todayISO } from "@/src/services/api";

/**
 * A check up: one look at one animal on one day (a Livestock Diagnosis).
 *
 * The fields are the ones the web Check up page records, sent to the same
 * endpoint it uses. The phone used to send a head-to-tail examination — chips
 * for eyes, nose, dung, a list of "disease indicator" flags — packed into the
 * notes as text, because the doctype has no such fields. Those are gone: what a
 * person records here is what the record holds.
 *
 * Choices (appearance, hydration, disease, action) come from the server's own
 * options; see healthOptions.ts.
 */
export type CreateCheckUpInput = {
  animal: string;
  /** Employee ID of whoever looked at her. */
  operator: string;
  /** Livestock Vet id of the vet who did the check, if one did. */
  vet?: string;
  /** ISO; today unless backdating. */
  diagnosisDate?: string;
  /** Why she was looked at (required). */
  reasonForCheck: string;
  temperatureC?: number;
  heartRate?: number;
  respirationRate?: number;
  /** Body condition score, 1 to 5 in quarter steps. */
  bcs?: number;
  /** 0 sound, 1 mild, 2 obvious limp, 3 will not bear weight. */
  lamenessScore?: number;
  appearance?: string;
  hydration?: string;
  /** Livestock Disease name. */
  suggestedDisease?: string;
  differentialNotes?: string;
  /** Livestock Diagnosis.action_taken (required). */
  actionTaken: string;
  followUpDate?: string;
  actionNotes?: string;
};

/**
 * Record the check up. An "Escalated to Case" action opens her health file (or
 * adds to the one she has) on the server; the reply says which.
 */
export const createCheckUp = async (input: CreateCheckUpInput): Promise<any> => {
  const body: Record<string, any> = {
    animal: input.animal,
    operator: input.operator,
    event_date: input.diagnosisDate || todayISO(),
    reason_for_check: input.reasonForCheck,
    action_taken: input.actionTaken,
  };
  if (input.vet) body.vet = input.vet;
  if (input.temperatureC != null) body.temperature_c = input.temperatureC;
  if (input.heartRate != null) body.heart_rate = input.heartRate;
  if (input.respirationRate != null) body.respiration_rate = input.respirationRate;
  if (input.bcs != null) body.bcs = input.bcs;
  if (input.lamenessScore != null) body.lameness_score = input.lamenessScore;
  if (input.appearance) body.appearance = input.appearance;
  if (input.hydration) body.hydration = input.hydration;
  if (input.suggestedDisease) body.suggested_disease = input.suggestedDisease;
  if (input.differentialNotes) body.differential_notes = input.differentialNotes;
  if (input.followUpDate) body.follow_up_date = input.followUpDate;
  if (input.actionNotes) body.action_notes = input.actionNotes;

  const client = await getClient();
  const res = await client.post(
    "/api/method/upande_livestock.serverscripts.health.create_check_up.create_check_up",
    { payload: body },
  );
  const msg = res.data?.message;
  if (!msg) throw new OpsError("create_check_up returned nothing.");
  if (msg.error) throw new OpsError(msg.error);
  return msg;
};
