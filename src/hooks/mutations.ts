import NetInfo from "@react-native-community/netinfo";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { markMoved } from "@/src/db/animals";
import { AnimalEventInput } from "@/src/frappe/animalEvent";
import { CreateCheckUpInput } from "@/src/frappe/checkUp";
import { TreatAnimalInput } from "@/src/frappe/treatment";
import { CreateMilkRecordingInput } from "@/src/frappe/milkRecording";
import { RecordQualityInput } from "@/src/frappe/milkQualityTest";
import type { FileAsset } from "@/src/frappe/files";
import type { PhotoContext } from "@/src/frappe/animalPhotos";
import type { ManualFeedInput } from "@/src/frappe/manualFeed";
import type { WeightOutcome, WeightSession } from "@/src/frappe/weights";
import { invalidateStock } from "@/src/hooks/useServerLists";
import { queuedTitle, type FeedChoice } from "@/src/feed/feedSessions";
import { kickDrain } from "@/src/offline/autoDrain";
import { keepQueuedPhoto } from "@/src/offline/photos";
import { PendingMutation, PendingMutationType, enqueue, newId } from "@/src/offline/queue";

/**
 * Every recording goes through `save`: it is written to the phone's queue first,
 * under a client_ref (a uuid), and the call returns as soon as it is stored. The
 * queue sends it in the background (src/offline) when there is signal; the server
 * keeps one answer per client_ref, so a resend files nothing twice.
 */

// Invalidate everything that could have changed: animals (herd / dates / repro
// status / weight history / count), herds (head counts), and today's milk
// (recorded yield). Conservative but cheap — React Query will refetch only
// the queries that are mounted.
const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["animals"] });
  qc.invalidateQueries({ queryKey: ["animal"] });
  qc.invalidateQueries({ queryKey: ["herds"] });
  qc.invalidateQueries({ queryKey: ["herd"] });
  qc.invalidateQueries({ queryKey: ["milk"] });
  qc.invalidateQueries({ queryKey: ["health-cases"] });
  qc.invalidateQueries({ queryKey: ["diagnoses"] });
  qc.invalidateQueries({ queryKey: ["disposals"] });
  // A save may have moved stock: what the pickers and the Stock list show must
  // be read again, not trusted for another 30 s.
  invalidateStock(qc);
};

/**
 * What a save returns. `queued` is always true: the recording is on the phone and
 * is on its way (or waiting for signal). `data` is the queue item, whose `id` is
 * the client_ref.
 */
export type OfflineMutationResult = {
  queued: true;
  data: PendingMutation;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** The phone's own time, "YYYY-MM-DD HH:MM:SS", for the audit trail. */
const nowStamp = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/** True when the phone has no signal right now. */
const noSignal = async (): Promise<boolean> => {
  try {
    const s = await NetInfo.fetch();
    const reachable = s.isInternetReachable ?? s.isConnected;
    return reachable === false;
  } catch {
    return false;
  }
};

/** Save a recording to the queue and start sending it. Resolves once it is stored. */
export const save = async (
  type: PendingMutationType,
  payload: any,
  label: string,
  keys?: string[],
  id: string = newId(),
): Promise<OfflineMutationResult> => {
  const item = await enqueue({ id, type, payload, label, keys });
  kickDrain();
  return { queued: true, data: item };
};

const animalKeys = (i: { animal?: string; animals?: string[]; herd?: string }): string[] =>
  i.animals?.length ? i.animals : i.animal ? [i.animal] : i.herd ? [`herd:${i.herd}`] : [];

/** Calf pictures are copied somewhere the OS will not clear before there is signal. */
const keepCalfPhotos = (input: AnimalEventInput): AnimalEventInput => {
  if (input.eventType !== "Calving" && input.eventType !== "Birth") return input;
  const calves = input.calves?.map((c) => (c.photo ? { ...c, photo: keepQueuedPhoto(c.photo) } : c));
  const calfPhoto = input.calfPhoto ? keepQueuedPhoto(input.calfPhoto) : undefined;
  return { ...input, calves, calfPhoto };
};

const labelOf = (input: AnimalEventInput): string => {
  const n = input.eventType === "Vaccination" || input.eventType === "Deworming" ||
    input.eventType === "Hoof Trimming" || input.eventType === "Dehorning"
    ? input.animals?.length ?? 0 : 0;
  return `${input.eventType} · ${n > 1 ? `${n} animals` : input.animal}`;
};

// ---------------------------------------------------------------------------

export const useCreateAnimalEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AnimalEventInput): Promise<OfflineMutationResult> => {
      const saved = keepCalfPhotos(input);
      const r = await save("AnimalEvent", saved, labelOf(input), animalKeys(input as any));
      // Cheap local truth: a moved animal shows in its new herd at once.
      if (input.eventType === "Movement") await markMoved([{ id: input.animal, herd: input.toHerd }]).catch(() => {});
      return r;
    },
    onSuccess: () => invalidateAll(qc),
  });
};

export const useCreateMilkRecording = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateMilkRecordingInput): Promise<OfflineMutationResult> =>
      save(
        "MilkRecording",
        // `offline` only when there was no signal: it asks the server for its day of grace.
        { ...input, offline: await noSignal(), capturedAt: nowStamp() },
        `Milk · ${input.herd}${input.milkingTime ? ` · ${input.milkingTime}` : ""}`,
        [`herd:${input.herd}`],
      ),
    onSuccess: () => invalidateAll(qc),
  });
};

/** A buyer's quality sheet; its slip photo is kept on the phone until it is sent. */
export const useRecordQualityTest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<RecordQualityInput, "clientRef">): Promise<OfflineMutationResult> => {
      const photo = input.slipPhoto ? keepQueuedPhoto(input.slipPhoto) : null;
      return save(
        "MilkQualityTest",
        { ...input, slipPhoto: photo, capturedAt: nowStamp() },
        `Milk quality · ${String(input.fields.sample_date ?? "")}`,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quality-tests"] });
      // The result is also written back onto the batch's milk recordings.
      qc.invalidateQueries({ queryKey: ["milk-batches"] });
      qc.invalidateQueries({ queryKey: ["quality-options"] });
      qc.invalidateQueries({ queryKey: ["milk"] });
    },
  });
};

export const useCreateCheckUp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCheckUpInput): Promise<OfflineMutationResult> =>
      save("AnimalDiagnosis", input, `Check-up · ${input.animal}`, [input.animal]),
    onSuccess: () => invalidateAll(qc),
  });
};

export const useTreatAnimal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TreatAnimalInput & { photo?: FileAsset | null }): Promise<OfflineMutationResult> => {
      const { photo, ...rest } = input;
      const id = newId();
      const r = await save("Treatment", rest, `Treatment · ${input.animal}`, [input.animal], id);
      // The photo is its own item, queued after the treatment for the same animal, and
      // names the treatment by client_ref: the server finds the health case from it.
      if (photo) {
        await save(
          "AnimalPhoto",
          { animal: input.animal, asset: keepQueuedPhoto(photo), context: "health_case", refClientRef: id },
          `Photo · ${input.animal}`,
          [input.animal],
        );
      }
      return r;
    },
    onSuccess: () => invalidateAll(qc),
  });
};

/** Weighings. "each" mode becomes one item per animal, so a refusal holds back only that animal. */
export const useRecordWeights = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: WeightSession): Promise<WeightOutcome> => {
      if (s.mode === "each") {
        for (const r of s.rows ?? []) {
          await save("Weights", { ...s, rows: [r] }, `Weight · ${r.animal} · ${r.weight_kg} kg`, [r.animal]);
        }
        const animals = (s.rows ?? []).map((r) => r.animal);
        return { count: animals.length, recorded: animals.map((animal) => ({ animal })), skipped: [], failed: [] };
      }
      const animals = s.group?.animals ?? [];
      await save("Weights", s, `Weights · ${animals.length} animals`, animals);
      return { count: animals.length, recorded: animals.map((animal) => ({ animal })), skipped: [], failed: [] };
    },
    onSuccess: () => invalidateAll(qc),
  });
};

/** A herd fed by the system's recipe (manufacture + issue). */
export const useManufactureHerdFeed = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      herd: string;
      portion?: number;
      postingDate?: string;
      bomNo?: string;
      feedSession?: FeedChoice;
      override?: boolean;
    }): Promise<OfflineMutationResult> =>
      save("Feeding", { action: "manufacture", ...v }, queuedTitle(`Feed · ${v.herd}`, v.feedSession), [`herd:${v.herd}`]),
    onSuccess: () => invalidateAll(qc),
  });
};

/** A herd fed a ration the operator tuned by hand. */
export const useManualFeedSave = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ManualFeedInput, "clientRef">): Promise<OfflineMutationResult> =>
      save("Feeding", { action: "manual", input }, `Manual feed · ${input.herd}`, [`herd:${input.herd}`]),
    onSuccess: (_d, input) => {
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: ["herdRecipes", input.herd] });
    },
  });
};

/** The animals list's suggested herd moves: one Movement item per animal. */
export const useApplyHerdMoves = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      moves: { animal: string; label: string; fromHerd: string; toHerd: string; reason: string }[];
      operator: string;
      eventDate: string;
    }): Promise<{ animal: string; ok: boolean; error?: string }[]> => {
      const out: { animal: string; ok: boolean; error?: string }[] = [];
      for (const m of v.moves) {
        try {
          await save(
            "AnimalEvent",
            {
              eventType: "Movement",
              animal: m.animal,
              currentHerd: m.fromHerd,
              operator: v.operator,
              eventDate: v.eventDate,
              toHerd: m.toHerd,
              remarks: `Ladder: ${m.reason}`,
            },
            `Movement · ${m.label}`,
            [m.animal],
          );
          out.push({ animal: m.label, ok: true });
        } catch (e: any) {
          out.push({ animal: m.label, ok: false, error: e?.message || "failed" });
        }
      }
      await markMoved(v.moves.map((m) => ({ id: m.animal, herd: m.toHerd }))).catch(() => {});
      return out;
    },
    onSuccess: () => invalidateAll(qc),
  });
};

/** A photo for an animal's gallery: kept on the phone, sent when there is signal. */
export const useAddAnimalPhoto = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { animal: string; asset: FileAsset; context: PhotoContext; ref?: string; caption?: string }) =>
      save("AnimalPhoto", { ...v, asset: keepQueuedPhoto(v.asset) }, `Photo · ${v.animal}`, [v.animal]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["animal-gallery"] }),
  });
};
