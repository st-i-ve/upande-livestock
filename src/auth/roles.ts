/**
 * Which livestock roles the signed-in user holds, and what each shows.
 *
 * The server sends the list (posting_day.roles) and enforces every permission;
 * the phone only uses it to choose which screens to offer.
 */
export const QUALITY_ROLE = "Livestock Quality";
export const MANAGER_ROLE = "Livestock Manager";

/** The user's only livestock role is Livestock Quality: they see the quality
 *  view and their profile, nothing else. Unknown roles (never answered) keep
 *  the normal app, so a failed lookup never locks anyone out. */
export const isQualityOnly = (roles: readonly string[] | null | undefined): boolean =>
  !!roles && roles.length > 0 && roles.every((r) => r === QUALITY_ROLE);

/** May open the quality view: holds Livestock Quality, or is a Manager. */
export const canSeeQuality = (roles: readonly string[] | null | undefined): boolean =>
  !!roles && (roles.includes(QUALITY_ROLE) || roles.includes(MANAGER_ROLE));
