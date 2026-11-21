/**
 * A parsed JSON file read as what it holds, never as the type a test wishes it had. Each reader
 * throws naming what it expected, so a fixture that drifts fails at the read.
 */
import type { MutationScope } from "../../../scripts/run-mutation.mjs";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseJsonRecord(text: string): Record<string, unknown> {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value)) throw new Error("expected a JSON object");
  return value;
}

export function stringList(value: unknown, what = "value"): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`expected ${what} to be a list of strings`);
  }
  return value.map(String);
}

function mutationScope(name: string, scope: unknown): MutationScope {
  if (!isRecord(scope)) throw new Error(`expected scope ${name} to be an object`);
  const { mutate, tests } = scope;
  return {
    mutate: typeof mutate === "string" ? mutate : stringList(mutate, `${name}.mutate`),
    ...(typeof scope.break === "number" ? { break: scope.break } : {}),
    ...(typeof scope.shards === "number" ? { shards: scope.shards } : {}),
    ...(tests === undefined ? {} : { tests: stringList(tests, `${name}.tests`) }),
    ...(scope.harnessOnly === true ? { harnessOnly: true } : {}),
  };
}

/** The scopes of `mutation-scopes.json`, each field checked as the scripts read it. */
export function mutationScopes(text: string): Record<string, MutationScope> {
  const { scopes } = parseJsonRecord(text);
  if (!isRecord(scopes)) throw new Error("expected `scopes` to be an object");
  return Object.fromEntries(
    Object.entries(scopes).map(([name, scope]) => [name, mutationScope(name, scope)])
  );
}
