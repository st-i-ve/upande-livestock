import { getClient } from "@/src/services/api";

export type EmployeeOption = {
  name: string;          // Employee ID, used as link value (e.g. "HR-EMP-01478")
  employeeName: string;  // display name (e.g. "Otieno David Ger")
  userId: string | null; // linked Frappe User email if any
};

const mapEmployee = (row: any): EmployeeOption => ({
  name: row.name,
  employeeName: row.employee_name || row.name,
  userId: row.user_id ?? null,
});

/**
 * Find the Employee record linked to a given Frappe user (the email used to
 * log in). Returns null if no Employee row has `user_id = email`.
 */
export const getEmployeeForUser = async (
  email: string,
): Promise<EmployeeOption | null> => {
  const client = await getClient();
  const res = await client.get("/api/resource/Employee", {
    params: {
      fields: JSON.stringify(["name", "employee_name", "user_id"]),
      filters: JSON.stringify([["user_id", "=", email]]),
      limit_page_length: 1,
    },
  });
  const rows = (res.data?.data ?? []) as any[];
  return rows[0] ? mapEmployee(rows[0]) : null;
};
