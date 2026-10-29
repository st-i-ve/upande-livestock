import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";

import { Field } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { useHerdChoices } from "@/src/shoats/hooks";
import type { ShoatHerd } from "@/src/shoats/api";

/**
 * The herd a shoat entry is for: the one the screen was opened from (`?herd=`),
 * else a pick among the herds of the species this phone works with. Returns the
 * picked herd and the field to render.
 */
export function useHerdField(label = "Herd", exclude?: string): { herd: ShoatHerd | null; field: React.ReactNode; loading: boolean } {
  const { herd: preset } = useLocalSearchParams<{ herd?: string }>();
  const choices = useHerdChoices();
  const [name, setName] = useState(() => (preset ? decodeURIComponent(String(preset)) : ""));
  const herd = choices.herds.find((h) => h.name === name) ?? null;
  const options = choices.herds.filter((h) => h.name !== exclude).map((h) => `${h.label} · ${h.head} head`);
  const field = (
    <Field label={label}>
      <Picker
        value={herd ? choices.labelOf(herd.name) : ""}
        options={options}
        onChange={(l) => setName(choices.nameOf(l))}
        placeholder={choices.isLoading ? "Loading herds…" : "Pick a herd"}
      />
    </Field>
  );
  return { herd, field, loading: choices.isLoading };
}

/** A herd picker for a destination (transfer to), with its own state. */
export function DestinationHerdField({ value, onChange, exclude, label = "To herd" }: { value: string; onChange: (name: string) => void; exclude?: string; label?: string }) {
  const choices = useHerdChoices();
  const options = choices.herds.filter((h) => h.name !== exclude).map((h) => `${h.label} · ${h.head} head`);
  return (
    <Field label={label}>
      <Picker value={value ? choices.labelOf(value) : ""} options={options} onChange={(l) => onChange(choices.nameOf(l))} placeholder="Pick a herd" />
    </Field>
  );
}
