/**
 * Which livestock roles the signed-in user holds. The server sends the list
 * (posting_day.roles) and enforces every permission; the phone only uses it to
 * choose which screens to offer.
 */
export const MANAGER_ROLE = "Livestock Manager";

/**
 * The nutritionist keeps the feed library's nutrient figures and balances the
 * herds' rations in the web app's Ration Editor; the server lets the role read
 * no animals and move no stock. Mirrors the web's frontend/src/lib/roles.ts.
 */
export const NUTRITIONIST_ROLE = "Livestock Nutritionist";

/** Roles that open the farm's screens; holding any of them, the phone is as before. */
const WIDER_ROLES = [
  "Livestock Manager",
  "Livestock Vet",
  "Livestock Breeder",
  "Livestock Attendant",
  "Livestock Stores",
  "System Manager",
  "Administrator",
];

/** True when the user holds the nutritionist role and no wider farm role.
 *  Roles not yet known (null) is never nutritionist-only. */
export function nutritionistOnly(roles: string[] | null | undefined): boolean {
  if (!roles) return false;
  return roles.includes(NUTRITIONIST_ROLE) && !roles.some((r) => WIDER_ROLES.includes(r));
}

/** Where the nutritionist's work is: the web app's Ration Editor on this site. */
export function rationEditorUrl(instanceUrl: string): string {
  return `${instanceUrl.replace(/\/+$/, "")}/livestock_app#/ration-editor`;
}
