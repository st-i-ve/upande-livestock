import { frappeCreateAndSubmit, todayISO } from "@/src/services/api";
import { listDocuments } from "./generic";

// Exact strings the Frappe DocType expects. The cull/death types use em-dashes
// (—) — must be sent verbatim. Verified against the live DocType.
export type DisposalType =
  | "Sold"
  | "Culled (Farm Use)"
  | "Died — Natural Causes"
  | "Died — Disease"
  | "Died — Accident"
  | "Condemned"
  | "Slaughtered";

export type CreateAnimalDisposalInput = {
  animal: string;                // Animal name
  animalName?: string;           // Display name (Animal.burn_name)
  disposalType: DisposalType;
  disposalDate?: string;         // ISO; default today
  bookValue?: number;            // KES (server pulls from Animal if absent)
  salePrice?: number;            // required when Sold
  buyerName?: string;
  buyerContact?: string;
  reasonDetails?: string;
  witness?: string;
  costCenter?: string;
  incomeAccount?: string;
  disposalAccount?: string;
};

/**
 * Create + submit an Animal Disposal. The After Submit server script handles
 * the three paths (sold / culled with insurance / culled without insurance)
 * per livestock_server_scripts §5.
 */
export type DisposalListRow = {
  name: string;
  animal: string;
  animalName: string;
  disposalDate: string;
  disposalType: DisposalType;
  bookValue: number;
  salePrice: number;
  gainLoss: number;
  buyerName: string | null;
  insuranceClaimAmount: number;
};

const DISPOSAL_LIST_FIELDS = [
  "name",
  "animal",
  "animal_name",
  "disposal_date",
  "disposal_type",
  "book_value",
  "sale_price",
  "gain_loss",
  "buyer_name",
  "insurance_claim_amount",
];

const mapDisposal = (row: any): DisposalListRow => ({
  name: row.name,
  animal: row.animal,
  animalName: row.animal_name || row.animal,
  disposalDate: row.disposal_date,
  disposalType: row.disposal_type,
  bookValue: Number(row.book_value ?? 0),
  salePrice: Number(row.sale_price ?? 0),
  gainLoss: Number(row.gain_loss ?? 0),
  buyerName: row.buyer_name ?? null,
  insuranceClaimAmount: Number(row.insurance_claim_amount ?? 0),
});

export const getDisposals = async (params?: {
  soldOnly?: boolean;
  cullsOnly?: boolean;
  limit?: number;
}): Promise<DisposalListRow[]> => {
  const filters: [string, string, any][] = [];
  if (params?.soldOnly) filters.push(["disposal_type", "=", "Sold"]);
  if (params?.cullsOnly) filters.push(["disposal_type", "!=", "Sold"]);
  const rows = await listDocuments({
    doctype: "Animal Disposal",
    fields: DISPOSAL_LIST_FIELDS,
    filters,
    orderBy: "disposal_date desc",
    limit: params?.limit ?? 200,
  });
  return rows.map(mapDisposal);
};

export const createAnimalDisposal = async (
  input: CreateAnimalDisposalInput,
): Promise<any> => {
  const body: Record<string, any> = {
    animal: input.animal,
    disposal_type: input.disposalType,
    disposal_date: input.disposalDate || todayISO(),
  };
  if (input.animalName) body.animal_name = input.animalName;
  if (input.bookValue != null) body.book_value = input.bookValue;
  if (input.salePrice != null) body.sale_price = input.salePrice;
  if (input.buyerName) body.buyer_name = input.buyerName;
  if (input.buyerContact) body.buyer_contact = input.buyerContact;
  if (input.reasonDetails) body.reason_details = input.reasonDetails;
  if (input.witness) body.witness = input.witness;
  if (input.costCenter) body.cost_center = input.costCenter;
  if (input.incomeAccount) body.income_account = input.incomeAccount;
  if (input.disposalAccount) body.disposal_account = input.disposalAccount;

  return frappeCreateAndSubmit("Animal Disposal", body);
};
