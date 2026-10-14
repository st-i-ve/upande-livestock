import { getClient } from "@/src/services/api";

/**
 * The vets a record may name: enabled Livestock Vet records, from the server.
 *
 * A vet is a record on the farm's system, not a name typed into a field — typed
 * names cannot be counted, so nobody could say whose cases recover. `mine` is
 * the Livestock Vet of whoever is logged in (null for most users), which the
 * screens start on; the server applies the same default when none is sent.
 */
export type VetOption = {
  /** Livestock Vet name (e.g. "VET-0001"), the link value sent as `vet`. */
  id: string;
  /** The vet's name as shown. */
  name: string;
  type: "Internal" | "External";
  /** Type and practice, for telling two vets apart. */
  detail: string;
};

export type VetOptions = { vets: VetOption[]; mine: string | null };

const OPTIONS = "/api/method/upande_livestock.serverscripts.people.vet_options.vet_options";

export const getVetOptions = async (): Promise<VetOptions> => {
  const client = await getClient();
  const res = await client.post(OPTIONS, { payload: {} });
  const msg = res.data?.message;
  if (!msg || msg.error) throw new Error(msg?.error || "Could not load the vets.");
  return {
    mine: msg.mine ?? null,
    vets: ((msg.vets ?? []) as any[]).map((v) => ({
      id: v.value,
      name: v.label || v.value,
      type: v.type,
      detail: v.detail ?? "",
    })),
  };
};
