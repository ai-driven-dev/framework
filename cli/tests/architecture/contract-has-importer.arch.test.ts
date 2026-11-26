/**
 * A context's `contract/` is what it offers other contexts. A contract file no other context
 * imports offers nothing, and returns to the context's own `domain/`.
 */
import { describe, expect, it } from "vitest";
import { contextOf, importersByFile, sourceFiles } from "./source-graph.js";

const CONTRACT_FILE = /^src\/contexts\/[^/]+\/contract\//;

/** The contract files no file outside their own context imports. */
function unusedContracts(
  files: readonly string[],
  importers: ReadonlyMap<string, ReadonlySet<string>>
): string[] {
  return files
    .filter((file) => CONTRACT_FILE.test(file))
    .filter((file) =>
      [...(importers.get(file) ?? [])].every((importer) => contextOf(importer) === contextOf(file))
    );
}

describe("contract files", () => {
  it("each has an importer from another context", () => {
    expect(unusedContracts(sourceFiles(), importersByFile())).toEqual([]);
  });

  it("names a contract file only its own context imports", () => {
    const own = "src/contexts/tools/contract/x.ts";
    const importers = new Map([[own, new Set(["src/contexts/tools/domain/y.ts"])]]);

    expect(unusedContracts([own], importers)).toEqual([own]);
  });
});
