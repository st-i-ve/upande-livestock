import { getClient } from "@/src/services/api";
import { STORAGE_KEYS, storage } from "@/src/services/storage";

/**
 * Who the signed-in user is on the farm's books.
 *
 * A user with no Employee linked to them is view-only: the server refuses every
 * record they try to make. The phone only mirrors that so it can hide the
 * buttons; it never decides.
 *
 * This used to read /api/resource/Employee, which the farm roles are not allowed
 * to read, so a herdsman with an Employee still looked unlinked. The answer now
 * rides on `posting_day`, which the server works out for any signed-in user.
 */
export type EmployeeStatus = {
  isEmployee: boolean;
  employee: string | null;
  employeeName: string | null;
  /** The livestock roles the user holds (only the app's own). `null` when the
   *  server did not say (an older server): the app then keeps its normal tabs. */
  roles: string[] | null;
};

const METHOD = "/api/method/upande_livestock.serverscripts.settings.posting_day.posting_day";

/** Fresh from the server. Throws when the server cannot be reached. */
export const fetchEmployeeStatus = async (): Promise<EmployeeStatus> => {
  const client = await getClient();
  const res = await client.get(METHOD);
  const m = res.data?.message;
  if (!m || m.error || typeof m.is_employee !== "boolean") {
    throw new Error("posting_day gave no employee answer");
  }
  const status: EmployeeStatus = {
    isEmployee: m.is_employee,
    employee: m.employee ?? null,
    employeeName: m.employee_name ?? null,
    roles: Array.isArray(m.roles) ? m.roles.map(String) : null,
  };
  await storage.setItem(STORAGE_KEYS.EMPLOYEE_STATUS, JSON.stringify(status));
  return status;
};

/** The last answer, for offline. Null when there never was one. */
export const cachedEmployeeStatus = async (): Promise<EmployeeStatus | null> => {
  try {
    const raw = await storage.getItem(STORAGE_KEYS.EMPLOYEE_STATUS);
    const v = raw ? JSON.parse(raw) : null;
    if (!v || typeof v.isEmployee !== "boolean") return null;
    return { ...v, roles: Array.isArray(v.roles) ? v.roles : null } as EmployeeStatus;
  } catch {
    return null;
  }
};
