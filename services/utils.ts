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
  if (a.repro === "Lactating" || a.repro === "Fresh / Lactating")
    return { label: `${a.dim ?? 0} DIM`, tone: "default" };
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
