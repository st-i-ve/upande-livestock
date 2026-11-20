/**
 * The Livestock Sires a Service can name. Pure helpers only (no React Native),
 * so the picker's rules run under `node --test`.
 */
export type SireType = "Semen" | "Live bull";

export type Sire = {
  /** Livestock Sire name: the link value sent as `sire_link`. */
  name: string;
  sireName: string;
  code: string;
  type: SireType;
  /** Item code of the straw, for a semen sire ("" when none). */
  semenItem: string;
  sexed: boolean;
  animal: string;
};

/** "Name · CODE", or just the name when the sire has no code. */
export const sireLabel = (s: Pick<Sire, "sireName" | "code">): string =>
  s.code ? `${s.sireName} · ${s.code}` : s.sireName;

/** The server's `sire_options` rows, as the phone holds them. Rows with no name are dropped. */
export const parseSires = (rows: unknown): Sire[] =>
  (Array.isArray(rows) ? rows : [])
    .filter((r: any) => r && r.name)
    .map((r: any) => ({
      name: String(r.name),
      sireName: String(r.sire_name || r.name),
      code: String(r.code || ""),
      type: r.type === "Live bull" ? "Live bull" : "Semen",
      semenItem: String(r.semen_item || ""),
      sexed: !!r.sexed,
      animal: String(r.animal || ""),
    }));

/** Sires matching the typed words (any order, name or code) and the type filter. */
export const filterSires = (sires: Sire[], query: string, type: SireType | "All" = "All"): Sire[] => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return sires.filter(
    (s) =>
      (type === "All" || s.type === type) &&
      words.every((w) => `${s.sireName} ${s.code}`.toLowerCase().includes(w)),
  );
};

/**
 * What the form sends for a sire. A picked sire goes as `sireLink`; the typed
 * fallback ("Sire not listed") goes as the legacy text only when nothing is
 * picked. Never both: the server fills the text from the record.
 */
export const sireFields = (linked: string, typed: string): { sireLink?: string; sire?: string } => {
  if (linked) return { sireLink: linked };
  const t = typed.trim();
  return t ? { sire: t } : {};
};
