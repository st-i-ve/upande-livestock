// Manual feeding is saved to the phone's queue first and sent when there is signal,
// like every recording (see mutations.ts). Kept under its old name for the screen.
export { useManualFeedSave as useManualFeed } from "@/src/hooks/mutations";
