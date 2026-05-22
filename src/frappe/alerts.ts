import type { Alert, Animal, DailyMilkRow } from "@/types";

import { todayISO } from "./milkRecording";

/**
 * Derive the home-screen "Action queue" entirely from already-fetched
 * animals and today's milk rows. No Frappe call of its own.
 */
export const buildSafetyAlerts = (
  animals: Animal[],
  todaysMilk: DailyMilkRow[],
): Alert[] => {
  const today = todayISO();
  const out: Alert[] = [];

  // 1. Animals still in withdrawal — danger.
  for (const a of animals) {
    if (!a.milkSafe) continue;
    if (a.milkSafe >= today) {
      out.push({
        sev: "danger",
        ic: "alert-octagon-outline",
        t: `${a.name} in withdrawal`,
        s: `Discard milk until ${a.milkSafe}`,
      });
    }
  }

  // 2. Fresh / lactating animals in treatment — colostrum risk in bulk tank.
  for (const a of animals) {
    if (!a.inTreatment) continue;
    if (!/lactating|fresh/i.test(a.repro)) continue;
    out.push({
      sev: "danger",
      ic: "water",
      t: "Colostrum present in fresh cow",
      s: `${a.name} · do not bulk-tank`,
    });
  }

  // 3. Milkings not yet recorded for today (per herd).
  for (const m of todaysMilk) {
    if (m.am === null) {
      out.push({
        sev: "default",
        ic: "clock-alert-outline",
        t: "AM milking not recorded",
        s: `${m.herd}${m.cnt ? ` · ${m.cnt} cows` : ""}`,
      });
    }
    if (m.pm === null) {
      out.push({
        sev: "default",
        ic: "clock-alert-outline",
        t: "PM milking pending",
        s: `${m.herd}${m.cnt ? ` · ${m.cnt} cows` : ""}`,
      });
    }
  }

  return out;
};
