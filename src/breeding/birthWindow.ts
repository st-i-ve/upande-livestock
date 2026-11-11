/**
 * The birth window, as the server judges it (serverscripts/common/birth_window.py).
 *
 * A birth is recorded straight away when the dam has a confirmed pregnancy, or a
 * service whose date puts the birth between service + min and service + max
 * days (Livestock Settings → Birth Window, 270–295 for cattle). Otherwise the
 * missing service is back-recorded first — the retro path. These functions only
 * explain and pre-check that on the phone; the server decides again on save.
 *
 * Dates are ISO `YYYY-MM-DD` strings and the arithmetic is in whole UTC days,
 * so a phone in any time zone agrees with the server on which day is which.
 */

export const DEFAULT_WINDOW = { minDays: 270, maxDays: 295 } as const;

export type Window = { minDays: number; maxDays: number };

const DAY = 86_400_000;

const toDay = (iso: string): number => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / DAY);
};

const fromDay = (n: number): string => new Date(n * DAY).toISOString().slice(0, 10);

/** `iso` moved by `days` (negative goes back). */
export const addDays = (iso: string, days: number): string => fromDay(toDay(iso) + days);

/** Whole days from `a` to `b` (b − a). */
export const daysBetween = (a: string, b: string): number => toDay(b) - toDay(a);

/** A sane window: numbers, the smaller first; falls back to the default. */
export const normaliseWindow = (minDays?: number | null, maxDays?: number | null): Window => {
  const lo = Number(minDays) > 0 ? Number(minDays) : DEFAULT_WINDOW.minDays;
  const hi = Number(maxDays) > 0 ? Number(maxDays) : DEFAULT_WINDOW.maxDays;
  return lo <= hi ? { minDays: lo, maxDays: hi } : { minDays: hi, maxDays: lo };
};

/** The service dates that put a birth on `birthDate` inside the window. */
export const serviceRange = (birthDate: string, w: Window): { from: string; to: string } => ({
  from: addDays(birthDate, -w.maxDays),
  to: addDays(birthDate, -w.minDays),
});

/** Does a service on `serviceDate` put a birth on `birthDate` inside the window? */
export const serviceFits = (serviceDate: string, birthDate: string, w: Window): boolean => {
  if (!serviceDate || !birthDate) return false;
  const gestation = daysBetween(serviceDate, birthDate);
  return gestation >= w.minDays && gestation <= w.maxDays;
};

/** A diagnosis must fall strictly after the service and strictly before the birth. */
export const diagnosisFits = (pdDate: string, serviceDate: string, birthDate: string): boolean =>
  !!pdDate && !!serviceDate && !!birthDate &&
  daysBetween(serviceDate, pdDate) > 0 && daysBetween(pdDate, birthDate) > 0;

/** A first guess at the service date: the middle of the range. */
export const suggestedServiceDate = (birthDate: string, w: Window): string =>
  addDays(birthDate, -Math.round((w.minDays + w.maxDays) / 2));

/** A first guess at the diagnosis date: 35 days after the service, kept before the birth. */
export const suggestedDiagnosisDate = (serviceDate: string, birthDate: string): string => {
  const guess = addDays(serviceDate, 35);
  return daysBetween(guess, birthDate) > 0 ? guess : addDays(serviceDate, 1);
};

export type RetroDraft = {
  serviceDate: string;
  serviceType: "A.I." | "Natural";
  /** Semen straw item (A.I.); optional — the server records an A.I. without one. */
  straw?: string;
  strawWarehouse?: string;
  /** Bull name / number, free text. */
  sire?: string;
  withDiagnosis: boolean;
  diagnosisDate?: string;
  /** The herd she was in on the service date. */
  herd: string;
  remarks?: string;
};

/** What is wrong with the retro steps, in words for the screen; null when ready. */
export const retroProblem = (
  d: RetroDraft,
  birthDate: string,
  w: Window,
  allowDiagnosis: boolean,
): string | null => {
  const range = serviceRange(birthDate, w);
  if (!d.serviceDate) return "Step 1: give the date of the service.";
  if (!serviceFits(d.serviceDate, birthDate, w)) {
    return `Step 1: the service must be between ${range.from} and ${range.to} (a calf is born ${w.minDays}–${w.maxDays} days after its service).`;
  }
  if (d.withDiagnosis) {
    if (!allowDiagnosis) return "Livestock Settings does not allow a diagnosis to be back-recorded. Leave it out.";
    if (!d.diagnosisDate || !diagnosisFits(d.diagnosisDate, d.serviceDate, birthDate)) {
      return `Step 2: the diagnosis must be after the service (${d.serviceDate}) and before the birth (${birthDate}).`;
    }
  }
  if (!d.herd) return "Step 3: choose the herd she was in on the service date.";
  return null;
};

/** The `retro` block record_birth takes (serverscripts/common/retro_birth.py). */
export const retroPayload = (d: RetroDraft) => ({
  service_date: d.serviceDate,
  service_type: d.serviceType,
  sire: d.sire?.trim() || undefined,
  items:
    d.serviceType === "A.I." && d.straw
      ? [{ item_code: d.straw, qty: 1, source_warehouse: d.strawWarehouse || undefined }]
      : undefined,
  herd: d.herd,
  remarks: d.remarks?.trim() || undefined,
  diagnosis: d.withDiagnosis && d.diagnosisDate ? { diagnosis_date: d.diagnosisDate } : null,
});

export type RetroPayload = ReturnType<typeof retroPayload>;

/** The server's stable code for a birth with no confirmed pregnancy and no service in the window. */
export const BIRTH_NEEDS_SERVICE = "birth_needs_service";
