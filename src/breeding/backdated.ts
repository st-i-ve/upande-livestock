/**
 * Saying out loud that a saved record is backdated.
 *
 * Every write endpoint answers `is_backdated` (the record's day is before the
 * day it was entered). The alert after a save says so, so nobody walks away
 * thinking a back-recorded service happened this morning.
 */
export const backdatedNote = (replies: any[]): string => {
  const n = replies.filter((r) => r?.is_backdated).length;
  if (!n) return "";
  return n === replies.length
    ? `Marked Backdated: ${n === 1 ? "this record is" : `all ${n} records are`} dated before today.`
    : `${n} of ${replies.length} records are marked Backdated.`;
};
