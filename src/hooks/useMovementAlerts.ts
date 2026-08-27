import { useQuery } from "@tanstack/react-query";

import { getClient } from "@/src/services/api";

type Alert = { sev: "danger" | "warn" | "default"; ic: string; t: string; s: string };

/**
 * Animals the herd structure says should have moved by now.
 *
 * The backend works this out from the growth ladder — days on a rung against the
 * days that rung allows — plus bull calves running out of their selling window
 * and cows that have gone too long without conceiving. It proposes; nobody is
 * moved by reading this.
 *
 * Overdue is a different severity from due on purpose. A herd with forty animals
 * ready to move and one three months late needs the late one visible, not
 * forty-first in a list.
 */
export const useMovementAlerts = () =>
  useQuery({
    queryKey: ["movement-alerts"],
    queryFn: async (): Promise<Alert[]> => {
      const client = await getClient();
      const res = await client.post(
        "/api/method/upande_livestock.api.operations.movement_suggestions",
        {},
      );
      const msg = res.data?.message;
      if (!msg || msg.error) throw new Error(msg?.error || "Could not read movement alerts.");

      const out: Alert[] = [];
      for (const r of msg.growth ?? []) {
        out.push({
          sev: r.overdue ? "danger" : "default",
          ic: r.overdue ? "clock-alert-outline" : "arrow-right-bold-box-outline",
          t: `${r.label} ${r.overdue ? "is overdue to move" : "is ready to move"}`,
          s: `${r.from_herd} → ${r.to_herd} · ${r.reason}`,
        });
      }
      for (const r of msg.bulls ?? []) {
        out.push({
          sev: r.overdue ? "danger" : "warn",
          ic: "cow",
          t: `${r.label} — bull calf ${r.overdue ? "past its window" : "nearing its window"}`,
          s: r.reason,
        });
      }
      for (const r of msg.open_cows ?? []) {
        out.push({
          sev: "warn",
          ic: "heart-broken-outline",
          t: `${r.label} has not conceived`,
          s: r.reason,
        });
      }
      // Overdue first — see the note above.
      return out.sort((a, b) => (a.sev === "danger" ? -1 : 0) - (b.sev === "danger" ? -1 : 0));
    },
    staleTime: 10 * 60_000,
  });
