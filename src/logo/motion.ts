/**
 * Sampling the desk tile's keyframes (src/art/paths.ts LOGO_MOTION, generated from the backend's
 * design/logo/livestock_motion.json) the way CSS does: between two stops the value moves along the
 * tile's cubic-bezier easing, applied per segment. Worklets, so the UI thread can call them; plain
 * functions in Jest.
 */

export type Stops = readonly (readonly [number, number])[];

/** CSS cubic-bezier(x1, y1, x2, y2) at progress t (0..1): solve x(s) = t, return y(s). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number, t: number): number {
  "worklet";
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const x = (s: number) => ((ax * s + bx) * s + cx) * s;
  const dx = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
  // Newton, then bisection if the slope is too flat to trust.
  let s = t;
  for (let i = 0; i < 8; i++) {
    const err = x(s) - t;
    if (Math.abs(err) < 1e-6) return ((ay * s + by) * s + cy) * s;
    const d = dx(s);
    if (Math.abs(d) < 1e-6) break;
    s -= err / d;
  }
  let lo = 0;
  let hi = 1;
  s = t;
  for (let i = 0; i < 30; i++) {
    const v = x(s);
    if (Math.abs(v - t) < 1e-6) break;
    if (v < t) lo = s;
    else hi = s;
    s = (lo + hi) / 2;
  }
  return ((ay * s + by) * s + cy) * s;
}

/** A track's value at progress p (0..1), eased per segment by `ease` (cubic-bezier control points). */
export function sample(stops: Stops, p: number, ease: readonly number[]): number {
  "worklet";
  if (p <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [o1, v1] = stops[i];
    if (p <= o1) {
      const [o0, v0] = stops[i - 1];
      const k = o1 === o0 ? 1 : cubicBezier(ease[0], ease[1], ease[2], ease[3], (p - o0) / (o1 - o0));
      return v0 + (v1 - v0) * k;
    }
  }
  return stops[stops.length - 1][1];
}
