/**
 * A recorded file's drift is one decision, taken in `domain/manifest/drift.ts`. A call site that
 * compares a digest itself grows its own vocabulary for it, and the verdicts part ways.
 *
 * Scoped to the installation context, which owns the manifest. Two sites compare a file with the
 * digest a plan expects before overwriting it: that is an overwrite decision, not drift.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, tsFilesUnder } from "./helpers.js";

const INSTALLATION = "src/contexts/installation";
const HOME = "src/contexts/installation/domain/manifest/drift.ts";
const OVERWRITE_DECISIONS: readonly string[] = [
  "src/contexts/installation/application/shared/remove-project-hooks.ts",
  "src/contexts/installation/application/materialize/project-hooks-materializer.ts",
];

const HASH_EQUALS = /[Hh]ash\w*\.equals\(|\.equals\(\s*[\w.]*[Hh]ash/;
const DIGEST_COMPARED = /\.value\)?\s*[!=]==|[!=]==\s*[\w.[\]?()]*\.value\b/;

function comparesDigests(source: string): boolean {
  return HASH_EQUALS.test(source) || DIGEST_COMPARED.test(source);
}

function installationSources(): [string, string][] {
  return tsFilesUnder(INSTALLATION).map((file) => [
    file,
    readFileSync(join(CLI_ROOT, file), "utf8"),
  ]);
}

describe("recorded-file drift", () => {
  it("is decided only in domain/manifest/drift.ts", () => {
    const outside = installationSources()
      .filter(([file, source]) => file !== HOME && comparesDigests(source))
      .map(([file]) => file)
      .filter((file) => !OVERWRITE_DECISIONS.includes(file));
    expect(outside).toEqual([]);
  });

  it("allows only the overwrite decisions that still compare a digest", () => {
    const sources = new Map(installationSources());
    const stale = OVERWRITE_DECISIONS.filter((file) => !comparesDigests(sources.get(file) ?? ""));
    expect(stale).toEqual([]);
  });

  describe("what counts as a comparison", () => {
    it.each([
      "return a.hash.equals(b);",
      "return diskHash.equals(file.hash);",
      "if (diskHash.value !== expected) {",
      "return FileHash.of(content).value === expected;",
      "return expected === disk.value;",
    ])("flags %s", (line) => {
      expect(comparesDigests(line)).toBe(true);
    });

    it.each([
      "plugin.withFiles(new Map(files.map((f) => [f.relativePath, f.hash.value])));",
      "const digest = hash.value;",
      "return driftOf(recorded.value, onDisk) === 'ok';",
    ])("leaves %s alone", (line) => {
      expect(comparesDigests(line)).toBe(false);
    });
  });
});
