import React, { useState } from "react";

import { DateField, fromISODate } from "@/components/DateTimeField";
import { Field } from "@/components/Field";
import { useBackdatingWindow } from "@/src/hooks/useBackdatingWindow";

/**
 * The date an entry is for. Today unless the farm has backdating open, in which
 * case the operator may pick an earlier day; `eventDate` is only sent then.
 */
export function useDayField(label = "Date it happened"): { eventDate: string | undefined; field: React.ReactNode; today: string } {
  const { open, today } = useBackdatingWindow();
  const [picked, setPicked] = useState("");
  const date = open && picked && picked !== today ? picked : undefined;
  const field = open ? (
    <Field label={label} help="Backdating is open: pick an earlier day if this was not today.">
      <DateField value={picked || today} onChange={setPicked} maximumDate={fromISODate(today)} />
    </Field>
  ) : null;
  return { eventDate: date, field, today };
}
