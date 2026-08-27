import { OpsError } from "./opsError";
import { getClient, todayISO } from "@/src/services/api";
import { listDocuments } from "./generic";

// Exact strings the Frappe DocType expects. The cull/death types use em-dashes
// (—) — must be sent verbatim. Verified against the live DocType.
export type DisposalType =
  | "Sold"
  | "Gifted"
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
  /** ERPNext Customer. With a sale price, the endpoint raises the invoice. */
  customer?: string;
  bookValue?: number;            // KES (server pulls from Animal if absent)
  salePrice?: number;            // required when Sold
  buyerName?: string;
  buyerContact?: string;
  reasonDetails?: string;
  witness?: string;
  costCenter?: string;
  incomeAccount?: string;
  disposalAccount?: string;
  /** Insurance claim amount (KES). Used by Frappe server scripts to post the receivable JE. */
  /** Not on Livestock Disposal. An insurance claim is its own document —
   *  Livestock Insurance Policy — so it is not sent here. */
  /** Recipient name when disposalType === "Gifted". */
  giftedTo?: string;
  /** Destination (place / organisation) when disposalType === "Gifted". */
  giftDestination?: string;
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
    doctype: "Livestock Disposal",
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
  if (input.bookValue != null) body.book_value = input.bookValue;
  if (input.salePrice != null) body.sale_price = input.salePrice;
  if (input.customer) body.customer = input.customer;
  if (input.buyerName) body.buyer_name = input.buyerName;
  if (input.buyerContact) body.buyer_contact = input.buyerContact;
  if (input.reasonDetails) body.reason_details = input.reasonDetails;
  if (input.witness) body.witness = input.witness;
  if (input.giftedTo) body.gifted_to = input.giftedTo;
  if (input.giftDestination) body.gift_destination = input.giftDestination;

  // record_disposal owns the doctype: it retires the animal, writes off the
  // book value and — for a sale with a customer and a price — raises the
  // invoice. A "Gifted" disposal takes the write-off branch, which is right:
  // the animal is gone and no income came in.
  const client = await getClient();
  const res = await client.post(
    "/api/method/upande_livestock.api.operations.record_disposal",
    { payload: body },
  );
  const msg = res.data?.message;
  if (!msg) throw new OpsError("record_disposal returned nothing.");
  if (msg.error) throw new OpsError(msg.error);
  return msg;
};
