import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CloneIdentity } from "../../../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import { resolutionKey } from "../../../../../../src/contexts/telemetry/domain/repository-resolution.js";
import { ResolutionStoreAdapter } from "../../../../../../src/contexts/telemetry/infrastructure/storage/ledger/resolution-store-adapter.js";
import { PrivateStorageAdapter } from "../../../../../../src/contexts/telemetry/infrastructure/storage/private-storage-adapter.js";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aidd-resolutions-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const CLONE: CloneIdentity = {
  path: "/a/.git",
  dev: "16",
  ino: "99",
  birthtimeMs: 1_700_000_000_000,
};

describe("the remembered resolutions", () => {
  it("are kept in roots.json beside the ledger, and read back", async () => {
    const store = new ResolutionStoreAdapter(join(root, "ledger"), new PrivateStorageAdapter());
    const resolution = {
      dir: "/a",
      repository_id: "id",
      root: "/a",
      clone: CLONE,
      seen_at: "2026-10-01T00:00:00.000Z",
    };
    const resolutions = new Map([[resolutionKey("/a", CLONE), resolution]]);
    await store.save(resolutions);
    expect(JSON.parse(await readFile(join(root, "ledger", "roots.json"), "utf8"))).toEqual({
      version: 2,
      directories: [resolution],
    });
  });

  it("start empty from a file of the format before clones had an identity", async () => {
    const store = new ResolutionStoreAdapter(join(root, "ledger"), new PrivateStorageAdapter());
    await store.save(new Map());
    await writeFile(
      join(root, "ledger", "roots.json"),
      JSON.stringify({
        "/a": { repository_id: "id", root: "/a", consented: true, clone: "/a/.git" },
      })
    );
    expect((await store.load()).size).toBe(0);
  });
});
