import React, { useMemo } from "react";

import { Field } from "@/components/Field";
import { Picker } from "@/components/Picker";
import type { VetOption } from "@/src/frappe/vets";

/**
 * Which vet did this, chosen from the farm's vets (never typed).
 *
 * The shared Picker works in plain strings, so each vet is offered by name — and
 * by name and record id when two share one — and the choice is mapped back to
 * the Livestock Vet id the server wants. Optional: a herder's own look at a cow
 * has no vet.
 */
export function VetPicker({
  vets,
  value,
  onChange,
  label = "Vet",
}: {
  vets: VetOption[];
  /** Livestock Vet id, or "". */
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  const { labels, byLabel } = useMemo(() => {
    const names = vets.map((v) => v.name);
    const map = new Map<string, string>();
    const shown = vets.map((v) => {
      const text =
        names.filter((n) => n === v.name).length > 1 ? `${v.name} · ${v.id}` : v.name;
      map.set(text, v.id);
      return text;
    });
    return { labels: shown, byLabel: map };
  }, [vets]);

  const current = vets.find((v) => v.id === value);
  const shownValue = current ? labels[vets.indexOf(current)] : "";

  return (
    <Field label={label} help={!vets.length ? "No vets are set up on the farm yet." : undefined}>
      <Picker
        value={shownValue}
        onChange={(text) => onChange(byLabel.get(text) ?? "")}
        options={labels}
        placeholder="None"
        clearable
      />
    </Field>
  );
}
