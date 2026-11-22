/**
 * A test of generic logic names a synthetic tool, not the registered list: only the composition,
 * the conformance suite and the golden know the real tools. The generic folders below import
 * `registered-tools.builder` only from the files the `real-tool-list:*` debts in `kinds-debt.json`
 * hold, each under the change that closes it: a test of a real tool's behaviour moves beside its
 * profile, a nominal-tool test converts once its builder takes an injected registry, and a builder
 * stops wiring the registered catalog. A file that stops importing it leaves the debt, and a new
 * importer is a violation.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { debtFamilyEntries } from "./kind-rule-support.js";
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

function importers(): string[] {
  return GENERIC_FOLDERS.flatMap((dir) => codeFilesUnder(dir)).filter((file) =>
    REAL_LIST.test(readFileSync(join(CLI_ROOT, file), "utf8"))
  );
}

describe("generic tests do not wire the real tool list", () => {
  it("imports it from exactly the files the real-tool-list debts hold", () => {
    expect(
      importers().sort(),
      "a generic test imports the real tool list, or a held file stopped: use SYNTHETIC_TOOL or update the real-tool-list debts"
    ).toEqual(debtFamilyEntries("real-tool-list").sort());
  });
});
