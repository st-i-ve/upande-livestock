/// <reference types="node" />
// A small jest-style `describe` / `it` / `expect` over node:test and node:assert,
// so pure-logic tests written for jest run under `npm test` (node --test).
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

type Matchers = {
  toBe(v: unknown): void;
  toEqual(v: unknown): void;
  toStrictEqual(v: unknown): void;
  toBeNull(): void;
  toBeUndefined(): void;
  toBeDefined(): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toContain(v: unknown): void;
  toHaveLength(n: number): void;
  toBeCloseTo(n: number, digits?: number): void;
  toBeGreaterThan(n: number): void;
  toBeGreaterThanOrEqual(n: number): void;
  toBeLessThan(n: number): void;
  toBeLessThanOrEqual(n: number): void;
  toMatch(re: RegExp | string): void;
  toThrow(): void;
  toMatchObject(v: unknown): void;
};

function make(actual: any, negate: boolean): Matchers {
  const ok = (cond: boolean, msg: string) => assert.ok(negate ? !cond : cond, `${negate ? "not " : ""}${msg}`);
  const same = (a: unknown, b: unknown) => {
    try {
      assert.deepStrictEqual(a, b);
      return true;
    } catch {
      return false;
    }
  };
  return {
    toBe: (v) => ok(Object.is(actual, v), `expected ${String(actual)} to be ${String(v)}`),
    toEqual: (v) => ok(same(actual, v), `expected ${JSON.stringify(actual)} to equal ${JSON.stringify(v)}`),
    toStrictEqual: (v) => ok(same(actual, v), `expected ${JSON.stringify(actual)} to equal ${JSON.stringify(v)}`),
    toBeNull: () => ok(actual === null, `expected ${String(actual)} to be null`),
    toBeUndefined: () => ok(actual === undefined, `expected ${String(actual)} to be undefined`),
    toBeDefined: () => ok(actual !== undefined, "expected a defined value"),
    toBeTruthy: () => ok(!!actual, `expected ${String(actual)} to be truthy`),
    toBeFalsy: () => ok(!actual, `expected ${String(actual)} to be falsy`),
    toContain: (v) => ok(actual.includes(v), `expected ${JSON.stringify(actual)} to contain ${JSON.stringify(v)}`),
    toHaveLength: (n) => ok(actual.length === n, `expected length ${actual.length} to be ${n}`),
    toBeCloseTo: (n, d = 2) => ok(Math.abs(actual - n) < 10 ** -d / 2, `expected ${actual} to be close to ${n}`),
    toBeGreaterThan: (n) => ok(actual > n, `expected ${actual} > ${n}`),
    toBeGreaterThanOrEqual: (n) => ok(actual >= n, `expected ${actual} >= ${n}`),
    toBeLessThan: (n) => ok(actual < n, `expected ${actual} < ${n}`),
    toBeLessThanOrEqual: (n) => ok(actual <= n, `expected ${actual} <= ${n}`),
    toMatch: (re) => ok(typeof re === "string" ? actual.includes(re) : re.test(actual), `expected ${actual} to match ${re}`),
    toMatchObject: (v) => {
      const sub = (a: any, b: any): boolean =>
        b && typeof b === "object"
          ? a != null && typeof a === "object" && Object.keys(b).every((k) => sub(a[k], b[k]))
          : Object.is(a, b);
      ok(sub(actual, v), `expected ${JSON.stringify(actual)} to match ${JSON.stringify(v)}`);
    },
    toThrow: () => {
      let threw = false;
      try {
        actual();
      } catch {
        threw = true;
      }
      ok(threw, "expected the function to throw");
    },
  };
}

export const expect = (actual: unknown): Matchers & { not: Matchers } => ({ ...make(actual, false), not: make(actual, true) });
export { beforeEach, describe, it };
