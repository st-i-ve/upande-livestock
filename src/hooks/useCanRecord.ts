import { useAuthStore } from "@/src/auth/authStore";

/** The server's words for a user with no Employee, kept identical so the phone
 *  and a refused request say the same thing. */
export const NOT_EMPLOYEE_MESSAGE =
  "You're not registered as an employee, so you can't record. Ask HR to link your user to an Employee.";
export const NOT_EMPLOYEE_MILKING_MESSAGE =
  "You're not registered as an employee, so you can't record milkings.";

/**
 * Whether this user may record anything. A user with no Employee is view-only:
 * Animals and Herds stay readable, every record button goes away. Unknown
 * (never answered) counts as allowed; the server refuses regardless.
 */
export function useCanRecord() {
  const isEmployee = useAuthStore((s) => s.isEmployee);
  return { canRecord: isEmployee !== false, message: NOT_EMPLOYEE_MESSAGE };
}
