/**
 * A test of generic logic names a synthetic tool, not the registered list: only the composition,
 * the conformance suite and the golden know the real tools. The generic folders below reach the
 * real list, by `registered-tools.builder`, by the registered accessors of `catalog-of.builder`,
 * by `catalogOf()` with no profiles or by `REGISTERED_PROFILES`, only from the files the
 * `real-tool-list:*` debts in `kinds-debt.json` hold, each under the change that closes it: a test
 * of a real tool's behaviour moves beside its profile or runs on a synthetic profile carrying the
 * section it needs. A file that stops reaching it leaves the debt, and a new one is a violation.
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
const REAL_LIST = [
  /registered-tools\.builder\.js["']/,
  /\b(?:registeredCatalog|registeredAiProfile|registeredAiConfig|registeredProfile|registeredConfig)\b/,
  /\bcatalogOf\(\)/,
  /\bREGISTERED_PROFILES\b/,
];
/** The builder that hands the registered catalog out is the source, not a reacher. */
const SOURCE = "tests/shared/testing/catalog-of.builder.ts";

function reachers(): string[] {
  return GENERIC_FOLDERS.flatMap((dir) => codeFilesUnder(dir))
    .filter((file) => file !== SOURCE)
    .filter((file) => {
      const text = readFileSync(join(CLI_ROOT, file), "utf8");
      return REAL_LIST.some((pattern) => pattern.test(text));
    });
}

describe("generic tests do not wire the real tool list", () => {
  it("reaches it from exactly the files the real-tool-list debts hold", () => {
    expect(
      reachers().sort(),
      "a generic test reaches the real tool list, or a held file stopped: use SYNTHETIC_TOOL or update the real-tool-list debts"
    ).toEqual(debtFamilyEntries("real-tool-list").sort());
  });
});
