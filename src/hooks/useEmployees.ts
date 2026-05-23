import { useQuery } from "@tanstack/react-query";

import { getEmployee, searchEmployees } from "@/src/frappe/employee";

export const useEmployeeSearch = (query: string) =>
  useQuery({
    queryKey: ["employees", query],
    queryFn: () => searchEmployees(query),
    staleTime: 60_000,
  });

export const useEmployee = (name: string | undefined) =>
  useQuery({
    queryKey: ["employee", name],
    queryFn: () => getEmployee(name!),
    enabled: !!name,
    staleTime: 5 * 60_000,
  });
