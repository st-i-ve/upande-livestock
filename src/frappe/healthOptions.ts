import { getClient } from "@/src/services/api";
import type { ItemsByEvent } from "@/src/frappe/eventItems";

/**
 * What the health screens offer, as the server reads it off the doctypes.
 *
 * The web check-up and treatment pages fill their dropdowns from this same
 * endpoint, so an option added on the desk (a disease, a route) appears on the
 * phone without a release, and a value the phone sends is always one the doctype
 * accepts. Nothing here is hard-coded on the handset.
 */
export type HealthOptions = {
  diseases: string[];
  appearances: string[];
  hydrations: string[];
  /** Livestock Diagnosis.action_taken */
  actions: string[];
  severities: string[];
  /** Livestock Health Treatment.route */
  routes: string[];
  /** Livestock Health Treatment.response_observed */
  responses: string[];
  items_by_event: ItemsByEvent;
  employee: string | null;
  company: string | null;
};

const OPTIONS =
  "/api/method/upande_livestock.serverscripts.health.health_options.health_options";

export const getHealthOptions = async (): Promise<HealthOptions> => {
  const client = await getClient();
  const res = await client.post(OPTIONS, {});
  const msg = res.data?.message;
  if (!msg || msg.error) throw new Error(msg?.error || "Could not load health options.");
  return {
    diseases: msg.diseases ?? [],
    appearances: (msg.appearances ?? []).filter(Boolean),
    hydrations: (msg.hydrations ?? []).filter(Boolean),
    actions: (msg.actions ?? []).filter(Boolean),
    severities: (msg.severities ?? []).filter(Boolean),
    routes: (msg.routes ?? []).filter(Boolean),
    responses: (msg.responses ?? []).filter(Boolean),
    items_by_event: msg.items_by_event ?? {},
    employee: msg.employee ?? null,
    company: msg.company ?? null,
  };
};
