import { getClient } from "@/src/services/api";
import { OpsError } from "./opsError";

const BIRTH_CHECK = "upande_livestock.serverscripts.breeding.birth_check.birth_check";

/** The server's answer to "may this birth be recorded?" (breeding/birth_check.py). */
export type BirthCheck = {
  allowed: boolean;
  basis: { kind: "diagnosis" | "service"; service: string; service_date: string } | null;
  message: string;
  current_herd: string;
  birth_date: string;
  window: { min_days: number; max_days: number };
  service_from: string;
  service_to: string;
  retro_allowed: boolean;
  retro_refusal: string;
  is_manager: boolean;
  backdating_open: boolean;
  allow_diagnosis: boolean;
  /** Only when asked with a service date: the herd her history puts her in that day. */
  herd_on_service_date?: string;
  service_date_fits?: boolean;
};

/** Ask before the calves are typed in. Online only; throws OpsError on a refusal. */
export const birthCheck = async (dam: string, birthDate: string, serviceDate?: string): Promise<BirthCheck> => {
  const client = await getClient();
  const res = await client.post(`/api/method/${BIRTH_CHECK}`, {
    payload: { dam, birth_date: birthDate, service_date: serviceDate || undefined },
  });
  const msg = res.data?.message;
  if (!msg) throw new OpsError("The birth check returned nothing.");
  if (msg.error) throw new OpsError(msg.error, msg.code, msg);
  return msg as BirthCheck;
};

/** The facts a `birth_needs_service` refusal carries, in the same shape as a check. */
export const checkFromRefusal = (details: Record<string, any> | undefined): BirthCheck | null => {
  if (!details || details.code !== "birth_needs_service") return null;
  return {
    allowed: false,
    basis: null,
    message: String(details.error ?? ""),
    current_herd: "",
    birth_date: details.birth_date,
    window: details.window ?? { min_days: 270, max_days: 295 },
    service_from: details.service_from,
    service_to: details.service_to,
    retro_allowed: !!details.retro_allowed,
    retro_refusal: details.retro_refusal ?? "",
    is_manager: !!details.is_manager,
    backdating_open: !!details.backdating_open,
    allow_diagnosis: details.allow_diagnosis !== false,
  };
};
