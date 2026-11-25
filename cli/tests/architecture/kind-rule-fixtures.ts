import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import type { Violation } from "./kinds.js";
import { CLI_ROOT, tsFilesUnder } from "./source-graph.js";

export const entries = (found: readonly Violation[]): string[] => found.map((v) => v.entry);

export function expectNone(found: readonly Violation[]): void {
  expect(found.map((violation) => violation.message)).toEqual([]);
}

export const textsOf = (paths: readonly string[]): Record<string, string> =>
  Object.fromEntries(paths.map((path) => [path, readFileSync(join(CLI_ROOT, path), "utf8")]));

let sources: Record<string, string> | undefined;
/** The text of every source file, read once per test file. */
export const src = (): Record<string, string> =>
  (sources ??= textsOf(tsFilesUnder("src").filter((path) => !path.endsWith(".d.ts"))));
