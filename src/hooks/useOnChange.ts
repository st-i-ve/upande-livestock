import { useState } from "react";

/**
 * Run `fn` during render when `value` differs from the previous render's (and
 * on the first render) — React's documented way to adjust state in response to
 * a changed input without an effect and the extra commit that comes with it.
 * `fn` may only set this component's own state.
 */
export function useOnChange<T>(value: T, fn: (value: T) => void): void {
  const [prev, setPrev] = useState<{ v: T } | null>(null);
  if (prev === null || !Object.is(prev.v, value)) {
    setPrev({ v: value });
    fn(value);
  }
}
