import type { Animal } from "@/types";

export function initials(name: string) {
  return name.split(" ").map((s) => s[0] || "").slice(0, 2).join("");
}

export function ageMonths(dob: string) {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
}

export function ageDays(dob: string) {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24));
}

export function avatarToneFor(a: Animal): "default" | "danger" {
  // Monochrome system: only "in treatment" warrants a tone. Everything else
  // is the neutral default — we differentiate animals by name and meta.
  return a.inTreatment ? "danger" : "default";
}

export type PillSpec = { label: string; tone: "default" | "danger" } | null;

// Single neutral pill style for status; only true problems use `danger`.
// The repro state is communicated by the label text, not by colour.
export function pillFor(a: Animal): PillSpec {
  if (a.inTreatment) return { label: "In treatment", tone: "danger" };
  if (a.repro === "Pregnant 8mo") return { label: "Steaming", tone: "default" };
  if (a.repro === "Pregnant 5mo") return { label: "In-calf", tone: "default" };
  if (a.repro === "Calf") return { label: "Calf", tone: "default" };
  if (a.repro === "Heifer / served") return { label: "Served", tone: "default" };
  if (a.repro === "Heifer") return { label: "Heifer", tone: "default" };
  if (a.repro === "Bull") return { label: "Bull", tone: "default" };
  return null;
}

export function fmtKES(n: number) {
  return n.toLocaleString();
}

/** The desk's wording for where an animal stands (frontend/src/lib/animals.ts, STAGES). */
export const STAGE_LABELS: Record<string, string> = {
  heifer: "Heifer",
  fresh: "Fresh",
  open: "Open",
  served: "Served",
  confirmed: "In calf",
  retired: "Left the herd",
};

/** Age the way the desk's portrait writes it: "12d", "6w", "14m", "2y 3m". */
export function ageFrom(bornOn: string | null | undefined, now = new Date()): string {
  if (!bornOn) return "—";
  const b = new Date(bornOn);
  if (Number.isNaN(b.getTime())) return "—";
  const days = Math.max(0, Math.round((now.getTime() - b.getTime()) / 86400000));
  if (days < 21) return `${days}d`;
  if (days < 90) return `${Math.round(days / 7)}w`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `${months}m`;
  return `${Math.floor(months / 12)}y ${months % 12}m`;
}
