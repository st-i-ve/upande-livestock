import type { Alert } from "@/types";

import { listDocuments } from "./generic";

/**
 * Service / PD / Calving timeline rows used to compute breeding-cycle
 * reminders. Pulled from Animal Event.
 */
type CycleEventRow = {
  animal: string;
  event_date: string;
  event_type: "Service" | "Pregnancy Diagnosis" | "Calving";
  diagnosis_result?: string | null;
};

const DAYS = (n: number) => n;

/**
 * Cycle thresholds (days after the relevant anchor):
 *
 *   service + 21  → first heat-check reminder
 *   service + 48  → PD due (popup)
 *   service + 213 → drying reminder (~2 months before calving)
 *   service + 282 → "calving tomorrow"
 *   service + 283 → "calving today"
 *
 * All references are anchored to the most recent Service per animal,
 * suppressed by a later PD result of "Not Pregnant" / "Aborted" or by
 * a later Calving.
 */
const HEAT_DAYS = DAYS(21);
const PD_DAYS = DAYS(48);
const DRY_DAYS = DAYS(213);
const CALVING_TOMORROW_DAYS = DAYS(282);
const CALVING_TODAY_DAYS = DAYS(283);

/**
 * Reads Animal Event from Frappe and returns the cycle-event rows we need.
 * Bounded to the last 365 days to keep the working set predictable.
 */
export async function fetchCycleEvents(): Promise<CycleEventRow[]> {
  const since = isoDateNDaysAgo(365);
  return listDocuments<CycleEventRow>({
    doctype: "Animal Event",
    fields: ["animal", "event_date", "event_type", "diagnosis_result"],
    filters: [
      ["docstatus", "=", 1],
      ["event_type", "in", ["Service", "Pregnancy Diagnosis", "Calving"]],
      ["event_date", ">=", since],
    ],
    limit: 5000,
  });
}

/**
 * Compute breeding-cycle alerts from a cycle-event timeline + animal-name
 * lookup. Pure function — easy to test in isolation.
 *
 * For each animal we compute:
 *   - latestService date (if any)
 *   - latestPD (date + result)
 *   - latestCalving date
 * Then we choose at most one alert per animal based on the most-urgent
 * threshold the timeline currently satisfies.
 */
export function buildBreedingAlerts(
  events: CycleEventRow[],
  animalNameById: Map<string, string>,
  today: string = todayLocalISO(),
): Alert[] {
  const byAnimal = new Map<string, { service?: string; pd?: { date: string; result: string }; calving?: string }>();
  for (const e of events) {
    const slot = byAnimal.get(e.animal) ?? {};
    if (e.event_type === "Service") {
      if (!slot.service || e.event_date > slot.service) slot.service = e.event_date;
    } else if (e.event_type === "Pregnancy Diagnosis") {
      if (!slot.pd || e.event_date > slot.pd.date) slot.pd = { date: e.event_date, result: e.diagnosis_result || "" };
    } else if (e.event_type === "Calving") {
      if (!slot.calving || e.event_date > slot.calving) slot.calving = e.event_date;
    }
    byAnimal.set(e.animal, slot);
  }

  const out: Alert[] = [];

  for (const [animal, slot] of byAnimal) {
    if (!slot.service) continue;

    // Closed-out cycles: a calving after the service, or a Not-Pregnant /
    // Aborted PD result, ends the cycle. Suppress all alerts.
    const closed =
      (slot.calving && slot.calving >= slot.service) ||
      (slot.pd && slot.pd.date >= slot.service && (slot.pd.result === "Not Pregnant" || slot.pd.result === "Aborted"));
    if (closed) continue;

    const daysSinceService = daysBetween(slot.service, today);
    const name = animalNameById.get(animal) || animal;

    // Most-urgent first. We emit at most one alert per animal.
    if (daysSinceService === CALVING_TODAY_DAYS || daysSinceService > CALVING_TODAY_DAYS) {
      out.push({
        sev: "danger",
        ic: "baby-carriage",
        t: "Calving today",
        s: `${name} · serviced ${slot.service} (${daysSinceService}d ago)`,
      });
      continue;
    }
    if (daysSinceService === CALVING_TOMORROW_DAYS) {
      out.push({
        sev: "danger",
        ic: "baby-carriage",
        t: "Calving tomorrow",
        s: `${name} · expected ${addDays(slot.service, 283)}`,
      });
      continue;
    }
    // Pregnancy confirmed + crossed the drying threshold.
    if (
      slot.pd?.result === "Confirmed" &&
      daysSinceService >= DRY_DAYS &&
      daysSinceService < CALVING_TOMORROW_DAYS
    ) {
      out.push({
        sev: "danger",
        ic: "water-off",
        t: "Dry off due",
        s: `${name} · ~${283 - daysSinceService}d to calving`,
      });
      continue;
    }
    // No PD yet AND we're past 48 days → PD due.
    if (!slot.pd && daysSinceService >= PD_DAYS) {
      out.push({
        sev: "danger",
        ic: "stethoscope",
        t: "PD due",
        s: `${name} · ${daysSinceService}d since service`,
      });
      continue;
    }
    // 21-day heat return reminder.
    if (!slot.pd && daysSinceService === HEAT_DAYS) {
      out.push({
        sev: "default",
        ic: "heart-pulse",
        t: "Watch for return to heat",
        s: `${name} · 21d since service`,
      });
      continue;
    }
  }

  return out;
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO).getTime();
  const b = new Date(toISO).getTime();
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function addDays(fromISO: string, n: number): string {
  const d = new Date(fromISO);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function isoDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function todayLocalISO(): string {
  return new Date().toISOString().slice(0, 10);
}
