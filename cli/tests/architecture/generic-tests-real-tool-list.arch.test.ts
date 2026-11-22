/**
 * A test of generic logic names a synthetic tool, not the registered list: only the composition,
 * the conformance suite and the golden know the real tools. The generic folders below may import
 * `registered-tools.builder` only from the files the `real-tool-list` debt in `kinds-debt.json` names, each one
 * a test of a real tool's behaviour or a builder that wires the registered catalog. The list only
 * shrinks: a file that stops importing it must leave the list, and a new importer is a violation.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { debtEntries } from "./kind-rule-support.js";
import { codeFilesUnder } from "./kind-tree.js";
import { CLI_ROOT } from "./source-graph.js";

const GENERIC_FOLDERS = [
  "tests/shared",
  "tests/presentation",
  "tests/orchestration",
  "tests/contexts/telemetry",
  "tests/contexts/distribution",
  "tests/contexts/auth",
  "tests/contexts/update",
];
const REAL_LIST = /registered-tools\.builder\.js["']/;

/** The orchestration sync scenario is owned by another lane and stays out of this rule. */
const isGeneric = (file: string): boolean => !file.startsWith("tests/orchestration/sync/");

function importers(): string[] {
  return GENERIC_FOLDERS.flatMap((dir) => codeFilesUnder(dir))
    .filter(isGeneric)
    .filter((file) => REAL_LIST.test(readFileSync(join(CLI_ROOT, file), "utf8")));
}

describe("generic tests do not wire the real tool list", () => {
  it("imports it only from the files written down", () => {
    const listed = new Set(Object.keys(debtEntries("real-tool-list")));
    expect(
      importers().filter((file) => !listed.has(file)),
      "a generic test imports the real tool list: use SYNTHETIC_TOOL or a synthetic profile"
    ).toEqual([]);
  });

  it("lists no file that stopped importing it", () => {
    const found = new Set(importers());
    expect(
      Object.keys(debtEntries("real-tool-list")).filter((file) => !found.has(file)),
      "remove the file from the real-tool-list debt in kinds-debt.json"
    ).toEqual([]);
  });
});
