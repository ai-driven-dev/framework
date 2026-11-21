import { describe, expect, it } from "vitest";
import { ResolveSyncConflict } from "../../../../src/contexts/installation/application/resolve-sync-conflict.use-case.js";
import { FileHash } from "../../../../src/shared/domain/file-hash.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";

const DISK_PATH = "/project/target.md";
const RELATIVE_PATH = "target.md";

async function conflictOver(disk: string | null, recorded: string | null): Promise<boolean> {
  const fs = new InMemoryFileAdapter({});
  if (disk !== null) await fs.writeFile(DISK_PATH, disk);
  return new ResolveSyncConflict(fs).execute({
    diskTargetPath: DISK_PATH,
    targetRelativePath: RELATIVE_PATH,
    targetManifestMap: new Map(
      recorded === null ? [] : [[RELATIVE_PATH, { value: FileHash.of(recorded).value }]]
    ),
  });
}

describe("ResolveSyncConflict", () => {
  it("finds a conflict when the file on disk changed since the manifest recorded it", async () => {
    expect(await conflictOver("edited", "installed")).toBe(true);
  });

  it("finds no conflict when the file still matches what the manifest recorded", async () => {
    expect(await conflictOver("installed", "installed")).toBe(false);
  });

  it("finds no conflict for a missing file", async () => {
    expect(await conflictOver(null, "installed")).toBe(false);
  });

  it("finds no conflict for a file the manifest never recorded", async () => {
    expect(await conflictOver("anything", null)).toBe(false);
  });
});
