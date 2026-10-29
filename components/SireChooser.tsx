import React, { useMemo } from "react";
import { StyleSheet, Text } from "react-native";

import { Banner } from "@/components/Banner";
import { Chip, Chips } from "@/components/Chips";
import { Field } from "@/components/Field";
import type { SireChoice } from "@/src/hooks/useSireChoice";
import { useColors } from "@/src/hooks/useColors";

/**
 * Who served her? One bull in her herd around the conception date is named and
 * kept unless the herdsman says "unknown"; several are offered to pick from; none
 * is a plain warning. Inbreeding lines for the chosen bull show before Save.
 */
export function SireChooser({ choice }: { choice: SireChoice }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { state } = choice;
  if (!state) {
    return choice.loading ? <Text style={s.hint}>Looking for the bull…</Text> : null;
  }
  const candidates =
    state.kind === "choose" ? state.candidates
    : state.kind === "inferred" && choice.inferredId ? [{ animal: choice.inferredId, label: state.label, basis: state.basis }]
    : [];
  return (
    <>
      <Field
        label="Sire (the farm's bull)"
        help={
          state.kind === "inferred" ? state.basis || "The mature bull in her herd at conception."
          : state.kind === "choose" ? "More than one bull was with her then. Pick the one you saw, or Unknown."
          : state.basis || "No mature bull was in her herd around that date."
        }
      >
        <Chips>
          {candidates.map((k) => (
            <Chip
              key={k.animal}
              label={state.kind === "inferred" ? `${k.label} (inferred)` : k.label}
              active={choice.sireAnimal === k.animal}
              onPress={() => choice.pick(k.animal)}
            />
          ))}
          <Chip label="Unknown" active={choice.sireUnknown} onPress={choice.pickUnknown} />
        </Chips>
      </Field>
      {state.kind === "none" ? (
        <Banner tone="warning">No bull is on record with her then. You can still save the service with the sire unknown.</Banner>
      ) : null}
      {choice.warnings.length ? (
        <Banner tone="warning" icon="alert">
          {["Inbreeding warning — you can still save:", ...choice.warnings].join("\n")}
        </Banner>
      ) : null}
    </>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({ hint: { fontSize: 12, color: c.textMuted, marginBottom: 8 } });
