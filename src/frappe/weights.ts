import { OpsError } from "@/src/frappe/opsError";
import { getClient } from "@/src/services/api";

const NS = "/api/method/upande_livestock.serverscripts.weights";

/** What Livestock Settings says about weighing, as the web Weights page reads it. */
export type WeightSettings = {
  /** Methods the farm offers; "Weighbridge" is absent when it has none. */
  methods: string[];
  /** Weighing Method Default, already one of `methods`. */
  defaultMethod: string;
  weighbridgeAvailable: boolean;
};

export type WeighingMode = "each" | "platform" | "alike";

export type WeightSession = {
  method: string;
  operator?: string | null;
  mode: WeighingMode;
  /** Mode "each": one row per animal that got on the scale. */
  rows?: { animal: string; weight_kg: number; heart_girth_cm?: number; bcs?: number }[];
  /** Modes "platform" / "alike": every animal that went through, and the one figure. */
  group?: { animals: string[]; total_weight_kg?: number; weight_kg?: number };
};

export type WeightOutcome = {
  count: number;
  recorded: { animal: string; name?: string }[];
  skipped: { animal: string; why: string }[];
  failed: { animal: string; why: string }[];
};

export const getWeightSettings = async (): Promise<WeightSettings> => {
  const client = await getClient();
  const res = await client.get(`${NS}.weight_options.weight_options`, {
    params: { settings_only: 1 },
  });
  const m = res.data?.message;
  if (!m || m.error) throw new Error(m?.error || "Weight options came back empty.");
  return {
    methods: m.methods ?? [],
    defaultMethod: m.default_method ?? m.methods?.[0] ?? "",
    weighbridgeAvailable: !!m.weighbridge_available,
  };
};

/**
 * The whole session in one call to the method the web Weights page uses, so the
 * server decides. A refused animal comes back in `failed` with its reason and
 * does not cost the others (record_weights saves each animal in a savepoint).
 */
export const recordWeights = async (s: WeightSession): Promise<WeightOutcome> => {
  const client = await getClient();
  const res = await client.post(`${NS}.record_weights.record_weights`, {
    payload: {
      method: s.method,
      measured_by: s.operator || undefined,
      weights: s.mode === "each" ? s.rows ?? [] : [],
      group: s.mode === "each" ? undefined : s.group,
    },
  });
  const m = res.data?.message;
  if (!m) throw new Error("Weight recording returned nothing.");
  if (m.error) throw new OpsError(m.error, m.code);
  return {
    count: m.count ?? 0,
    recorded: m.recorded ?? [],
    skipped: m.skipped ?? [],
    failed: m.failed ?? [],
  };
};
