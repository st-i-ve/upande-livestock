import React from "react";

import { Field, Input } from "@/components/Field";

const fmt = (n: number) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

/**
 * The group's kilos, typed, on a farm not feeding by head count (Livestock
 * Settings > Feed by Head Count off). Seeded with head count x per head as a
 * suggestion; what is typed here is what the server mixes and issues.
 */
export function GroupTotalField({
  value,
  onChange,
  heads,
  perHeadKg,
  portion = 1,
  suggestion,
}: {
  value: string;
  onChange: (v: string) => void;
  heads: number;
  perHeadKg: number;
  portion?: number;
  suggestion: number;
}) {
  const part = portion === 1 ? "" : portion === 0.5 ? " × half a day" : ` × ${portion}`;
  return (
    <Field
      label="Kilos this group was given"
      help={`Suggested: ${fmt(heads)} head × ${fmt(perHeadKg)} kg${part} = ${fmt(suggestion)} kg. This farm feeds by the group's total, so enter what went into the trough.`}
    >
      <Input value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder={fmt(suggestion)} />
    </Field>
  );
}
