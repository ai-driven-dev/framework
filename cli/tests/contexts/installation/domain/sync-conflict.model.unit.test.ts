import { describe, expect, it } from "vitest";
import { isSyncConflict } from "../../../../src/contexts/installation/domain/sync-conflict.model.js";
import { FileHash } from "../../../../src/shared/domain/file-hash.js";

describe("a sync conflict", () => {
  it("is a file on disk changed since the manifest recorded it", () => {
    expect(isSyncConflict(FileHash.of("installed"), FileHash.of("edited"))).toBe(true);
  });

  it("is not a file that still matches what the manifest recorded", () => {
    expect(isSyncConflict(FileHash.of("installed"), FileHash.of("installed"))).toBe(false);
  });

  it("is not a missing file", () => {
    expect(isSyncConflict(FileHash.of("installed"), null)).toBe(false);
  });

  it("is not a file the manifest never recorded", () => {
    expect(isSyncConflict(undefined, FileHash.of("anything"))).toBe(false);
  });
});
