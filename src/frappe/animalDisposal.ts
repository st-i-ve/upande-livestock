import { OpsError } from "./opsError";
import { getClient, todayISO } from "@/src/services/api";

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
  /** Livestock Vet id of the vet who attended. Defaults to the logged-in vet. */
  vet?: string;
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
  if (input.vet) body.vet = input.vet;
  if (input.giftedTo) body.gifted_to = input.giftedTo;
  if (input.giftDestination) body.gift_destination = input.giftDestination;

  // record_disposal owns the doctype: it retires the animal, writes off the
  // book value and — for a sale with a customer and a price — raises the
  // invoice. A "Gifted" disposal takes the write-off branch, which is right:
  // the animal is gone and no income came in.
  const client = await getClient();
  const res = await client.post(
    "/api/method/upande_livestock.serverscripts.disposal.record_disposal.record_disposal",
    { payload: body },
  );
  const msg = res.data?.message;
  if (!msg) throw new OpsError("record_disposal returned nothing.");
  if (msg.error) throw new OpsError(msg.error, msg.code);
  return msg;
};
