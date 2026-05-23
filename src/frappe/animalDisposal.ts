import { frappeCreateAndSubmit, todayISO } from "@/src/services/api";

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
