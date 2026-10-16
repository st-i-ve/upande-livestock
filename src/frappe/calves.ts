import type { FileAsset } from "./files";

/**
 * One calf of a calving. A calving carries one or more of these (twins, triplets);
 * each has its own sex, outcome, weight, photo and herd.
 *
 * There is no number here on purpose. The server gives every live calf the next
 * book number in its sex's series (A for a heifer, B for a bull) when the animal
 * is created, and the phone shows it afterwards.
 */
export type CalfInput = {
  sex: "Female" | "Male";
  burnName?: string;
  birthWeightKg?: number;
  coatColour?: string;
  healthStatus?: "Healthy" | "Weak" | "Needs Attention" | "Critical";
  breed?: string;
  /** Empty means the herd Livestock Settings routes this sex to. */
  herd?: string;
  isStillborn?: boolean;
  /** Local file; uploaded when the calving is sent. */
  photo?: FileAsset | null;
};

/** The single calf an older build queued, in the shape a calving carries now. */
export const legacyCalf = (i: {
  calfGender?: "Female" | "Male";
  calfBurnName?: string;
  birthWeightKg?: number;
  coatColour?: string;
  calfHealthStatus?: CalfInput["healthStatus"];
  calfBreed?: string;
  calfTargetHerd?: string;
  calfPhoto?: FileAsset;
}): CalfInput => ({
  sex: i.calfGender ?? "Female",
  burnName: i.calfBurnName,
  birthWeightKg: i.birthWeightKg,
  coatColour: i.coatColour,
  healthStatus: i.calfHealthStatus,
  breed: i.calfBreed,
  herd: i.calfTargetHerd,
  photo: i.calfPhoto,
});
