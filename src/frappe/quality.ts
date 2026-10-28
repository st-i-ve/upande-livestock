import { OpsError } from "@/src/frappe/opsError";
import { getClient } from "@/src/services/api";

/**
 * Milk quality and feed quality, the same two server methods and payload keys
 * the web's Quality and Quality & Feed pages use. Online only: the figures are
 * filed against a milking the server holds, and nothing here is queued.
 */
const OPTIONS = "/api/method/upande_livestock.serverscripts.quality.quality_options.quality_options";
const RECORD = "/api/method/upande_livestock.serverscripts.quality.record_milk_quality.record_milk_quality";
const FEED = "/api/method/upande_livestock.serverscripts.quality.quality_vs_feed.quality_vs_feed";

export type PendingRecording = {
  name: string;
  herd: string;
  recording_date: string;
  milking_time: string | null;
  total_yield_kg: number;
  net_yield_kg: number;
  cows_milked: number;
};

export type QualityResult = {
  name: string;
  herd: string;
  recording_date: string;
  bulk_scc: number | null;
  fat_percent: number | null;
  protein_percent: number | null;
  lab_test_date: string | null;
  over_ceiling: boolean;
};

export type QualityOptions = {
  mode: "At milking" | "Afterwards";
  required_at_milking: boolean;
  required_in_lab: boolean;
  scc_ceiling: number;
  pending: PendingRecording[];
  recent: QualityResult[];
  can_write: boolean;
};

const unwrap = <T>(msg: any, fallback: string): T => {
  if (!msg) throw new Error(fallback);
  if (msg.error) throw new OpsError(msg.error, msg.code);
  return msg as T;
};

export const getQualityOptions = async (days = 60): Promise<QualityOptions> => {
  const client = await getClient();
  const res = await client.post(OPTIONS, { days });
  return unwrap<QualityOptions>(res.data?.message, "Could not load the quality list.");
};

export type QualityEntry = {
  recording: string;
  bulk_scc?: number;
  fat_percent?: number;
  protein_percent?: number;
  lab_test_date?: string;
  remarks?: string;
};

export type QualityFiled = {
  name: string;
  bulk_scc: number | null;
  fat_percent: number | null;
  protein_percent: number | null;
  over_ceiling: boolean;
  still_pending: boolean;
};

export const recordMilkQuality = async (entry: QualityEntry): Promise<QualityFiled> => {
  const client = await getClient();
  const res = await client.post(RECORD, { payload: entry });
  return unwrap<QualityFiled>(res.data?.message, "The server gave no answer.");
};

export type Metric = "fat" | "protein" | "scc";

export const METRICS: Record<Metric, { label: string; better: "higher" | "lower" }> = {
  fat: { label: "Butterfat", better: "higher" },
  protein: { label: "Protein", better: "higher" },
  scc: { label: "Somatic cells", better: "lower" },
};

export type HerdFeedQuality = {
  herd: string;
  cows: number;
  ration: {
    bom: string;
    name: string;
    per_head: number;
    uom: string;
    concentrate_kg: number;
    concentrate_share: number | null;
    lines: { item_code: string; item_name: string; qty: number; uom: string; concentrate: boolean }[];
  } | null;
  fed: { runs: number; kg: number };
  quality: {
    fat: number | null;
    protein: number | null;
    scc: number | null;
    readings: number;
    milkings: number;
    milk_per_cow_day: number | null;
  };
  vs_rest: { fat: number | null; protein: number | null; scc: number | null };
};

export type FeedQuality = {
  days: number;
  from_date: string;
  to_date: string;
  windows: number[];
  herds: HerdFeedQuality[];
  weeks: { week: string; herds: Record<string, { fat: number | null; protein: number | null; scc: number | null }> }[];
};

export const getFeedQuality = async (days: number): Promise<FeedQuality> => {
  const client = await getClient();
  const res = await client.post(FEED, { payload: { days } });
  return unwrap<FeedQuality>(res.data?.message, "Could not load the quality figures.");
};

/** SCC is held in cells/ml and read in thousands; the rest as given. */
export const formatMetric = (metric: Metric, v: number | null | undefined): string => {
  if (v == null) return "—";
  return metric === "scc" ? `${Math.round(v / 1000)}k` : `${v.toFixed(2)}%`;
};
