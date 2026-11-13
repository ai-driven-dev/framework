/**
 * A unit test may not import `node:fs`, but `tests/helpers/ports/seed-from-directory.ts` reads a
 * real directory on its behalf, past the biome guard. Importing it is the debt: a unit file that
 * does so is either renamed `.integration` or taken off the helper.
 */
import { readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, expectRatchet, read } from "./helpers.js";

// Unit files importing the directory-reading helper. The list may only shrink.
const BASELINE: readonly string[] = [
  "tests/contexts/distribution/application/add-marketplace.unit.test.ts",
  "tests/contexts/distribution/application/refresh-marketplace-progress.unit.test.ts",
  "tests/contexts/distribution/application/refresh-marketplace.unit.test.ts",
  "tests/contexts/framework/application/flows/marketplace-check-use-case.unit.test.ts",
  "tests/contexts/framework/application/plugin/plugin-add-mcp.unit.test.ts",
  "tests/contexts/framework/application/plugin/plugin-add-use-case.unit.test.ts",
  "tests/contexts/framework/application/plugin/plugin-install-from-marketplace-use-case.unit.test.ts",
  "tests/contexts/framework/application/plugin/plugin-remove-use-case.unit.test.ts",
  "tests/contexts/framework/application/plugin/plugin-update-built-tree.unit.test.ts",
  "tests/contexts/framework/application/plugin/plugin-update-mode-a-marketplace.unit.test.ts",
  "tests/contexts/framework/application/plugin/plugin-update-use-case.unit.test.ts",
  "tests/contexts/framework/application/restore-all-use-case.unit.test.ts",
  "tests/contexts/framework/application/restore-use-case.unit.test.ts",
  "tests/contexts/framework/application/shared/apply-plugin-files-built-tree.unit.test.ts",
  "tests/contexts/framework/application/shared/apply-plugin-files-mode-a-marketplace.unit.test.ts",
  "tests/contexts/framework/application/shared/apply-plugin-files-use-case.unit.test.ts",
  "tests/contexts/framework/application/uninstall-plugin.unit.test.ts",
  "tests/presentation/prompts/plugin-pick-use-case.unit.test.ts",
];

const SEEDER = /["'][^"']*\/seed-from-directory\.js["']/;

function unitFiles(): string[] {
  return readdirSync(join(CLI_ROOT, "tests"), { recursive: true, encoding: "utf8" })
    .map((entry) => join("tests", entry).split(sep).join("/"))
    .filter((path) => path.endsWith(".unit.test.ts"))
    .sort();
}

function importers(sources: ReadonlyMap<string, string>): string[] {
  return [...sources]
    .filter(([, text]) => SEEDER.test(text))
    .map(([path]) => path)
    .sort();
}

function measured(): string[] {
  return importers(new Map(unitFiles().map((path) => [path, read(path)])));
}

describe("unit tests stay off the helper that reads a real directory", () => {
  it("no unit test newly imports seed-from-directory", () => {
    const { added } = expectRatchet(measured(), BASELINE);
    expect(added, "new unit importer: use an in-memory double, or rename it .integration").toEqual(
      []
    );
  });

  it("lists no unit test that no longer imports it", () => {
    const { fixed } = expectRatchet(measured(), BASELINE);
    expect(fixed, "no longer imports the helper: remove it from BASELINE").toEqual([]);
  });
});

describe("the guard itself", () => {
  it("finds a static and a dynamic import, and ignores other text", () => {
    const sources = new Map([
      ["a.unit.test.ts", 'import { s } from "../../helpers/ports/seed-from-directory.js";'],
      ["b.unit.test.ts", 'const m = await import("../helpers/ports/seed-from-directory.js");'],
      ["c.unit.test.ts", 'import { x } from "./other.js";'],
    ]);
    expect(importers(sources)).toEqual(["a.unit.test.ts", "b.unit.test.ts"]);
  });

  it("names a new importer in added and a stale entry in fixed", () => {
    expect(expectRatchet(["a.unit.test.ts"], []).added).toEqual(["a.unit.test.ts"]);
    expect(expectRatchet([], ["gone.unit.test.ts"]).fixed).toEqual(["gone.unit.test.ts"]);
  });

  it("walks tests/ and finds a unit file", () => {
    expect(unitFiles()).toContain(
      "tests/contexts/framework/application/restore-use-case.unit.test.ts"
    );
  });
});
