import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createAnimal } from "@/src/frappe/animal";
import { AnimalEventInput, createAnimalEvent } from "@/src/frappe/animalEvent";
import {
  CreateAnimalDisposalInput,
  createAnimalDisposal,
} from "@/src/frappe/animalDisposal";
import {
  CreateAnimalDiagnosisInput,
  createAnimalDiagnosis,
} from "@/src/frappe/animalDiagnosis";
import {
  CreateAnimalHealthCaseInput,
  createAnimalHealthCase,
} from "@/src/frappe/animalHealthCase";
import {
  CreateCalfFeedingInput,
  createCalfFeeding,
} from "@/src/frappe/calfFeeding";
import {
  CreateMilkRecordingInput,
  createMilkRecording,
} from "@/src/frappe/milkRecording";
import type { CreateAnimalInput } from "@/src/frappe/animal";

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
};

export const useCreateAnimalEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AnimalEventInput) => createAnimalEvent(input),
    onSuccess: () => invalidateAll(qc),
  });
};

export const useCreateMilkRecording = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMilkRecordingInput) => createMilkRecording(input),
    onSuccess: () => invalidateAll(qc),
  });
};

export const useCreateAnimalDisposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAnimalDisposalInput) => createAnimalDisposal(input),
    onSuccess: () => invalidateAll(qc),
  });
};

export const useCreateAnimal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAnimalInput) => createAnimal(input),
    onSuccess: () => invalidateAll(qc),
  });
};

export const useCreateCalfFeeding = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCalfFeedingInput) => createCalfFeeding(input),
    onSuccess: () => invalidateAll(qc),
  });
};

export const useCreateAnimalDiagnosis = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAnimalDiagnosisInput) => createAnimalDiagnosis(input),
    onSuccess: () => invalidateAll(qc),
  });
};

export const useCreateAnimalHealthCase = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAnimalHealthCaseInput) => createAnimalHealthCase(input),
    onSuccess: () => invalidateAll(qc),
  });
};
