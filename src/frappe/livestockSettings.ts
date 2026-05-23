import { getClient } from "@/src/services/api";

/**
 * Pulls a single field value from the `Livestock Settings` single DocType.
 * Used to default Company, expense accounts, milk warehouse, milk price, etc.
 */
export const getLivestockSetting = async <T = string>(
  field: string,
): Promise<T | null> => {
  const client = await getClient();
  const res = await client.get("/api/method/frappe.client.get_single_value", {
    params: { doctype: "Livestock Settings", field },
  });
  return (res.data?.message ?? null) as T | null;
};

export const getDefaultCompany = (): Promise<string | null> =>
  getLivestockSetting<string>("custom_default_company");
