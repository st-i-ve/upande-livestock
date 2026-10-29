import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { sireState, type SireState } from "@/src/beef/sire";
import { kinshipCheck } from "@/src/frappe/kinship";
import { sireCandidates } from "@/src/frappe/sire";
import type { Animal } from "@/types";

export type SireChoice = {
  /** What the server found: one bull, several, or none. */
  state: SireState | null;
  loading: boolean;
  /** The bull the herdsman settled on ("" = leave it to the server). */
  sireAnimal: string;
  sireUnknown: boolean;
  /** The single bull the server inferred, if there was exactly one. */
  inferredId: string;
  pick: (animal: string) => void;
  pickUnknown: () => void;
  /** Several bulls were there and he has not chosen yet. */
  needsChoice: boolean;
  /** Inbreeding lines for this female and the chosen bull, shown before Save. */
  warnings: string[];
};

/**
 * The sire line of a natural service or diagnosis, for ONE female: who was the
 * mature bull in her herd around the conception date, and does the chosen bull
 * happen to be her father, son or brother? Several females at once are left to the
 * server, which infers per female and answers with `candidates` where it cannot.
 */
export function useSireChoice(female: Animal | null, conceptionDate: string, enabled: boolean): SireChoice {
  const id = female?.id ?? "";
  const key = `${id}|${conceptionDate}`;
  // The herdsman's pick belongs to one female and one date; a different key starts over.
  const [picked, setPicked] = useState<{ key: string; sire: string; unknown: boolean }>({ key: "", sire: "", unknown: false });
  const mine = picked.key === key ? picked : { key, sire: "", unknown: false };

  const q = useQuery({
    queryKey: ["sire-candidates", id, conceptionDate],
    queryFn: () => sireCandidates(id, conceptionDate),
    enabled: enabled && !!id && !!conceptionDate,
    staleTime: 30_000,
  });
  const state = q.data ? sireState(q.data) : null;
  // One bull found: he is the sire unless the herdsman says otherwise.
  const inferredId = q.data?.sireAnimal ?? (q.data?.candidates.length === 1 ? q.data.candidates[0].animal : "");
  const sireUnknown = mine.unknown;
  const sireAnimal = mine.sire || (!sireUnknown ? inferredId : "");

  const kin = useQuery({
    queryKey: ["kinship-service", sireAnimal, id],
    queryFn: async () => {
      const r = await kinshipCheck(sireAnimal, female!.herd);
      return r.conflicts.filter((c) => c.other === id).map((c) => c.message).filter((m): m is string => !!m);
    },
    enabled: enabled && !!sireAnimal && !!female?.herd,
    staleTime: 30_000,
  });

  return {
    state,
    loading: q.isFetching,
    sireAnimal,
    sireUnknown,
    inferredId,
    pick: (a) => setPicked({ key, sire: a, unknown: false }),
    pickUnknown: () => setPicked({ key, sire: "", unknown: true }),
    needsChoice: state?.kind === "choose" && !sireAnimal && !sireUnknown,
    warnings: kin.data ?? [],
  };
}
