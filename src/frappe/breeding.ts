import { listDocuments } from "./generic";

/**
 * Returns the set of Animal IDs whose latest Service event is more recent
 * than their latest Pregnancy Diagnosis or Calving event. These are the
 * animals that should appear in the PD picker — they've been served and
 * are awaiting diagnosis.
 *
 * Both queries are bounded to the last 365 days to keep the response set
 * predictable on busy farms. Animals serviced before that window are
 * almost certainly already diagnosed (or stale data) and shouldn't dominate
 * the picker.
 */
export async function getServicedPendingPdAnimalIds(): Promise<Set<string>> {
  const since = isoDateNDaysAgo(365);

  const [services, closings] = await Promise.all([
    listDocuments<{ animal: string; event_date: string }>({
      doctype: "Animal Event",
      fields: ["animal", "event_date"],
      filters: [
        ["docstatus", "=", 1],
        ["event_type", "=", "Service"],
        ["event_date", ">=", since],
      ],
      limit: 5000,
    }),
    listDocuments<{ animal: string; event_date: string; event_type: string }>({
      doctype: "Animal Event",
      fields: ["animal", "event_date", "event_type"],
      filters: [
        ["docstatus", "=", 1],
        ["event_type", "in", ["Pregnancy Diagnosis", "Calving"]],
        ["event_date", ">=", since],
      ],
      limit: 5000,
    }),
  ]);

  const latestService = new Map<string, string>();
  for (const s of services) {
    const prev = latestService.get(s.animal);
    if (!prev || s.event_date > prev) latestService.set(s.animal, s.event_date);
  }

  const latestClosing = new Map<string, string>();
  for (const c of closings) {
    const prev = latestClosing.get(c.animal);
    if (!prev || c.event_date > prev) latestClosing.set(c.animal, c.event_date);
  }

  const out = new Set<string>();
  for (const [animal, svc] of latestService) {
    const close = latestClosing.get(animal);
    if (!close || svc > close) out.add(animal);
  }
  return out;
}

function isoDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
