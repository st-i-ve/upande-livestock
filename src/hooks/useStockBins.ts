import { useQuery } from "@tanstack/react-query";

import { getStockBins } from "@/src/frappe/stock";

type Args = {
  warehouse?: string;
  itemCodeLike?: string;
  itemNameLike?: string;
  enabled?: boolean;
};

export const useStockBins = ({ warehouse, itemCodeLike, itemNameLike, enabled = true }: Args) =>
  useQuery({
    queryKey: ["stock-bins", warehouse ?? "*", itemCodeLike ?? "", itemNameLike ?? ""],
    queryFn: () => getStockBins({ warehouse, itemCodeLike, itemNameLike }),
    enabled,
    staleTime: 60_000,
  });
