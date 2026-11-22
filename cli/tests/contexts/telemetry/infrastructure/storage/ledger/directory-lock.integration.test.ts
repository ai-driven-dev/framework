import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DirectoryLock } from "../../../../../../src/contexts/telemetry/infrastructure/storage/ledger/directory-lock.js";
import { PrivateStorageAdapter } from "../../../../../../src/shared/infrastructure/private-storage-adapter.js";

let root: string;
let dir: string;
const quick = { waitMs: 0, pollMs: 1 };

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aidd-directory-lock-"));
  dir = join(root, "kept");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const lockOf = () =>
  new DirectoryLock({ dir, file: ".lock", storage: new PrivateStorageAdapter(), options: quick });

describe("a lock on a file in a private directory", () => {
  it("creates the directory, holds the lock during the work and frees it after", async () => {
    const held = await lockOf().exclusively(async () => readdir(dir));
    expect(held).toEqual([".lock"]);
    expect(await readdir(dir)).toEqual([]);
  });

  it("returns what the work returns", async () => {
    expect(await lockOf().exclusively(async () => 7)).toBe(7);
  });

  it("frees the lock when the work fails", async () => {
    await expect(
      lockOf().exclusively(async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    expect(await readdir(dir)).toEqual([]);
  });

  it("refuses a second holder while the work runs", async () => {
    await lockOf().exclusively(async () => {
      await expect(lockOf().exclusively(async () => 1)).rejects.toThrow(/locked by process/);
    });
  });

  it("waits no longer than the wait it is given for", async () => {
    const patient = new DirectoryLock({
      dir,
      file: ".lock",
      storage: new PrivateStorageAdapter(),
      options: {
        waitMs: 60_000,
        pollMs: 1,
      },
    });
    await lockOf().exclusively(async () => {
      await expect(patient.exclusively(async () => 1, 0)).rejects.toThrow(/locked by process/);
    });
  });
});
