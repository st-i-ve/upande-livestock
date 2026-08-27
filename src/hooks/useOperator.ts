import { useAuthStore } from "@/src/auth/authStore";

/**
 * The Employee the logged-in user is, for stamping on what they record.
 *
 * Every record screen used to ask for this with a picker, which was asking a
 * person to tell the app who they are when the app already knew: login resolves
 * the Employee linked to the user and stores it. The picker also let anyone
 * record work against somebody else's name by accident.
 *
 * `missing` is the one case worth surfacing — a user with no Employee record
 * cannot stamp anything, and the fix is on the desk, not in this form.
 */
export function useOperator() {
  const employee = useAuthStore((s) => s.employeeName);
  return {
    operator: employee,
    missing: !employee,
    /** What to tell someone whose user has no Employee behind it. */
    missingMessage:
      "Your user has no Employee record, so this cannot be recorded against you. Ask an administrator to link one.",
  };
}
