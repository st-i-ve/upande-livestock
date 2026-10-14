import { useHealthOptions } from "@/src/hooks/useHealthOptions";

/**
 * The in-stock items an event type may use, with the store and quantity for
 * each. `undefined` while loading or if the call failed; an absent key means
 * the event type is not set to post stock (Livestock Event Type).
 */
export const useEventItems = (eventType: string) => {
  const q = useHealthOptions();
  return {
    ...q,
    choices: q.data?.items_by_event?.[eventType],
    /** Whether this event type is set to issue stock at all, as the server says. */
    consumes: !!q.data && Object.prototype.hasOwnProperty.call(q.data.items_by_event ?? {}, eventType),
  };
};
