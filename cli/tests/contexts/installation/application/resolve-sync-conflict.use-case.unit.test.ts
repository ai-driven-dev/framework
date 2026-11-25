import { describe, expect, it } from "vitest";
import { ResolveSyncConflict } from "../../../../src/contexts/installation/application/resolve-sync-conflict.use-case.js";
import { FileHash } from "../../../../src/shared/domain/file-hash.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";

const DISK_PATH = "/project/target.md";

// The comparison itself is the sync-conflict model's (sync-conflict.model.unit.test.ts); these
// cases prove the file is read from disk, and that a missing one is answered without a read.
describe("looking for a sync conflict", () => {
  it("reads the file on disk to find it changed since the manifest recorded it", async () => {
    const fs = new InMemoryFileAdapter({});
    await fs.writeFile(DISK_PATH, "edited");
    const conflict = new ResolveSyncConflict(fs);
    expect(
      await conflict.execute({ diskPath: DISK_PATH, recorded: FileHash.of("installed") })
    ).toBe(true);
  });

  it("finds no conflict for a file no longer on disk", async () => {
    const conflict = new ResolveSyncConflict(new InMemoryFileAdapter({}));
    expect(
      await conflict.execute({ diskPath: DISK_PATH, recorded: FileHash.of("installed") })
    ).toBe(false);
  });
});
