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

/** The files whose text reaches the real tool list. */
function reaching(texts: Readonly<Record<string, string>>): string[] {
  return Object.entries(texts)
    .filter(([file, text]) => file !== SOURCE && REAL_LIST.some((pattern) => pattern.test(text)))
    .map(([file]) => file);
}

function genericTests(): Record<string, string> {
  return Object.fromEntries(
    GENERIC_FOLDERS.flatMap((dir) => codeFilesUnder(dir)).map((file) => [
      file,
      readFileSync(join(CLI_ROOT, file), "utf8"),
    ])
  );
}

describe("generic tests do not wire the real tool list", () => {
  it("sees each way to reach the list, and not the builder that hands it out", () => {
    const found = reaching({
      "a.ts": 'import { x } from "./registered-tools.builder.js";',
      "b.ts": "const p = registeredProfile();",
      "c.ts": "const c = catalogOf();",
      "d.ts": "const r = REGISTERED_PROFILES;",
      "e.ts": "const c = catalogOf([SYNTHETIC_TOOL]);",
      [SOURCE]: "export const registeredCatalog = 1;",
    });

    expect(found).toEqual(["a.ts", "b.ts", "c.ts", "d.ts"]);
  });

  it("reaches it from no file", () => {
    expect(
      reaching(genericTests()),
      "a generic test reaches the real tool list: use SYNTHETIC_TOOL, or move the test beside the profile"
    ).toEqual([]);
  });
});
