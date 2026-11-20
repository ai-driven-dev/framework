import { describe, expect, it } from "vitest";
import {
  parseMergeFileEntries,
  toMergeFileEntryData,
} from "../../../../../src/contexts/installation/domain/manifest/merge-files.js";
import { FileHash } from "../../../../../src/shared/domain/file.js";

const HASH = "abc123abc123abc123abc123abc123ab";

describe("merge file entries", () => {
  it("serializes each entry hash to its value", () => {
    expect(
      toMergeFileEntryData([
        { relativePath: "a.json", sectionKey: "mcpServers", entries: { x: new FileHash(HASH) } },
      ])
    ).toEqual([{ relativePath: "a.json", sectionKey: "mcpServers", entries: { x: HASH } }]);
  });

  it("parses each stored value back to a hash, keeping a null section", () => {
    const [parsed] = parseMergeFileEntries([
      { relativePath: "a.json", sectionKey: null, entries: { x: HASH } },
    ]);

    expect(parsed.sectionKey).toBeNull();
    expect(parsed.entries.x).toBeInstanceOf(FileHash);
    expect(parsed.entries.x.value).toBe(HASH);
  });
});
