import { getClient } from "@/src/services/api";

export type FrappeFilter = [string, string, any];

export type ListDocumentsArgs = {
  doctype: string;
  fields?: string[];
  filters?: FrappeFilter[];
  searchQuery?: string;
  searchField?: string;
  orderBy?: string;
  limit?: number;
};

/**
 * Generic Frappe list query. Used by remote-search pickers (Item, Warehouse,
 * Sire Catalog, Account, etc.) and any read screen that needs ad-hoc data.
 */
export const listDocuments = async <T = Record<string, any>>(
  args: ListDocumentsArgs,
): Promise<T[]> => {
  const client = await getClient();
  const params: Record<string, any> = {
    fields: JSON.stringify(args.fields ?? ["name"]),
    limit_page_length: args.limit ?? 20,
  };
  if (args.orderBy) params.order_by = args.orderBy;

  const filters: FrappeFilter[] = [...(args.filters ?? [])];
  if (args.searchQuery && args.searchField) {
    filters.push([args.searchField, "like", `%${args.searchQuery}%`]);
  }
  if (filters.length) params.filters = JSON.stringify(filters);

  const res = await client.get(`/api/resource/${encodeURIComponent(args.doctype)}`, {
    params,
  });
  return (res.data?.data ?? []) as T[];
};
