/**
 * Offline preview backend.
 *
 * Under the DEV auth bypass there is no Frappe instance and no session, so
 * `getClient()` would throw and every screen would render its error state
 * instead of its UI. This stands in for the server: an axios adapter that
 * answers the same URLs with fixture rows in the same shape Frappe returns,
 * so the real mappers, hooks and components all run untouched.
 *
 * Rows are shaped from the live Kaitet instance (`get_doctype_info("Herds")`,
 * `get_doctype_info("Milk Recording")`), so the field names here are the real
 * ones — a screen that works against this will work against the server.
 *
 * Unknown doctypes answer with an empty list and unknown methods with `{}`,
 * so a screen reaching for something un-fixtured renders empty rather than
 * throwing. Writes are accepted and discarded.
 */
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";

import { animals as mockAnimals } from "@/data/mock";

/** Herds, verbatim from the live instance. Three are milking herds — the milk
 *  form filters on exactly this flag. */
const HERDS: Record<string, any>[] = [
  { name: "0-2", herd_name: "0-2", custom_is_milking: 0, custom_is_dry: 0, custom_is_calf_rearing: 1, custom_herd_category: "Youngstock < 12m", number_of_animals: 4 },
  { name: "2-4", herd_name: "2-4", custom_is_milking: 0, custom_is_dry: 0, custom_is_calf_rearing: 1, custom_herd_category: "Youngstock < 12m", number_of_animals: 0 },
  { name: "4-12 MONTHS", herd_name: "4-12 MONTHS", custom_is_milking: 0, custom_is_dry: 0, custom_is_calf_rearing: 0, custom_herd_category: "Youngstock < 12m", number_of_animals: 0 },
  { name: "12 MONTHS-SERVICE", herd_name: "12 MONTHS-SERVICE", custom_is_milking: 0, custom_is_dry: 0, custom_is_calf_rearing: 0, custom_herd_category: "Youngstock > 12m", number_of_animals: 0 },
  { name: "INCALF HEIFERS", herd_name: "INCALF HEIFERS", custom_is_milking: 0, custom_is_dry: 0, custom_is_calf_rearing: 0, custom_herd_category: "Youngstock > 12m", number_of_animals: 2 },
  { name: "In calf heifers", herd_name: "In calf heifers", custom_is_milking: 0, custom_is_dry: 0, custom_is_calf_rearing: 0, custom_herd_category: "Youngstock > 12m", number_of_animals: 0 },
  { name: "Bullying Heifers", herd_name: "Bullying Heifers", custom_is_milking: 0, custom_is_dry: 0, custom_is_calf_rearing: 0, custom_herd_category: null, number_of_animals: 0 },
  { name: "STEAMERS", herd_name: "STEAMERS", custom_is_milking: 0, custom_is_dry: 1, custom_is_calf_rearing: 0, custom_herd_category: "Dry", number_of_animals: 0 },
  { name: "BULLS", herd_name: "BULLS", custom_is_milking: 0, custom_is_dry: 0, custom_is_calf_rearing: 0, custom_herd_category: null, number_of_animals: 1 },
  { name: "Lactating group 1", herd_name: "Lactating group 1", custom_is_milking: 1, custom_is_dry: 0, custom_is_calf_rearing: 0, custom_herd_category: "Milking", number_of_animals: 3 },
  { name: "LACTATION GROUP 2", herd_name: "LACTATION GROUP 2", custom_is_milking: 1, custom_is_dry: 0, custom_is_calf_rearing: 0, custom_herd_category: "Milking", number_of_animals: 1 },
  { name: "Super high yielders", herd_name: "Super high yielders", custom_is_milking: 1, custom_is_dry: 0, custom_is_calf_rearing: 0, custom_herd_category: "Milking", number_of_animals: 0 },
];

/** The animal fixtures already in the repo, turned back into Frappe rows so
 *  `mapAnimal` does the same work it does against the server. */
const ANIMALS: Record<string, any>[] = mockAnimals.map((a) => ({
  name: a.id,
  burn_name: a.name,
  sex: a.sex,
  date_of_birth: a.dob,
  current_herd: a.herd,
  repro_status: a.repro,
  days_in_milk: a.dim,
  parity: a.parity,
  last_weight_kg: a.lastWt,
  milk_safe_date: a.milkSafe,
  in_treatment: a.inTreatment,
  pregnant: a.pregnant,
}));

const MILKING_HERDS = HERDS.filter((h) => h.custom_is_milking).map((h) => h.name);

const COLLECTIONS: Record<string, Record<string, any>[]> = {
  Herds: HERDS,
  Animal: ANIMALS,
  Employee: [
    { name: "HR-EMP-00001", employee_name: "Preview Operator", user_id: "dev@upande.local" },
  ],
  "Milk Recording": [],
};

const SINGLES: Record<string, Record<string, any>> = {
  "Livestock Settings": {
    name: "Livestock Settings",
    milk_price_per_kg: 60,
    default_company: "Upande Livestock",
  },
};

/** Whitelisted `/api/method/...` endpoints. Anything absent answers `{}`. */
const METHODS: Record<string, (body: any, params: any) => any> = {
  "upande_livestock.api.operations.eligibility": () => ({
    milking_herds: MILKING_HERDS,
    calf_rearing_herds: HERDS.filter((h) => h.custom_is_calf_rearing).map((h) => h.name),
    dry_herds: HERDS.filter((h) => h.custom_is_dry).map((h) => h.name),
  }),
  "frappe.client.get_count": () => ANIMALS.length,
  "frappe.client.get_single_value": (_b, params) =>
    SINGLES[params?.doctype ?? ""]?.[params?.field ?? ""] ?? null,
  // Writes are accepted so the success screen can be reached, then dropped.
  "frappe.client.insert": (body) => ({ ...(body?.doc ?? {}), name: "PREVIEW-0001" }),
  "frappe.client.submit": (body) => ({ ...(body?.doc ?? {}), docstatus: 1 }),
  "frappe.client.set_value": () => ({ name: "PREVIEW-0001" }),
};

const ok = (data: any, config: InternalAxiosRequestConfig): AxiosResponse => ({
  data,
  status: 200,
  statusText: "OK (preview)",
  headers: {},
  config,
});

const parseBody = (raw: any) => {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
};

export const previewAdapter: AxiosAdapter = async (config) => {
  const url = (config.url ?? "").split("?")[0];
  const params = config.params ?? {};
  const body = parseBody(config.data);

  // /api/method/<dotted.path>
  const method = url.match(/\/api\/method\/(.+)$/)?.[1];
  if (method) {
    const decoded = decodeURIComponent(method);
    const handler = METHODS[decoded];
    return ok({ message: handler ? handler(body, params) : {} }, config);
  }

  // /api/resource/<Doctype>[/<name>]
  const resource = url.match(/\/api\/resource\/(.+)$/)?.[1];
  if (resource) {
    const parts = decodeURIComponent(resource).split("/");
    const doctype = parts[0];
    const docname = parts[1];

    if (docname) {
      const single = SINGLES[doctype];
      if (single) return ok({ data: single }, config);
      const row = (COLLECTIONS[doctype] ?? []).find((r) => r.name === docname);
      if (!row) {
        return Promise.reject(
          Object.assign(new Error(`preview: no ${doctype} named ${docname}`), {
            response: { status: 404, data: {}, config },
            config,
          }),
        );
      }
      return ok({ data: row }, config);
    }

    if (config.method?.toLowerCase() === "post") {
      return ok({ data: { ...body, name: "PREVIEW-0001", docstatus: 0 } }, config);
    }
    return ok({ data: COLLECTIONS[doctype] ?? [] }, config);
  }

  return ok({ message: {} }, config);
};
