/**
 * The value stored for a column of one synced animal. A blank `image` or
 * `thumb` (the farm removed her picture) is stored as NULL, so the row that
 * replaces the old one holds no path and the phone shows her silhouette.
 */
export function storedValue(col: string, value: unknown): unknown {
  if ((col === "image" || col === "thumb") && !value) return null;
  return value ?? null;
}
