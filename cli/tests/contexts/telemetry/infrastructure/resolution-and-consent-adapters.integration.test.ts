import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CloneIdentity } from "../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import { resolutionKey } from "../../../../src/contexts/telemetry/domain/repository-resolution.js";
import { ConsentHistoryAdapter } from "../../../../src/contexts/telemetry/infrastructure/consent/consent-history-adapter.js";
import { ResolutionStoreAdapter } from "../../../../src/contexts/telemetry/infrastructure/resolution-store-adapter.js";
import { PrivateStorageAdapter } from "../../../../src/runtime/filesystem/private-storage-adapter.js";

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
    expect((await store.load()).size).toBe(0);
    const resolution = {
      dir: "/a",
      repository_id: "id",
      root: "/a",
      clone: CLONE,
      seen_at: "2026-10-01T00:00:00.000Z",
    };
    const resolutions = new Map([[resolutionKey("/a", CLONE), resolution]]);
    await store.save(resolutions);
    expect(await store.load()).toEqual(resolutions);
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

describe("the consent history", () => {
  const history = () =>
    new ConsentHistoryAdapter(join(root, "ledger"), new PrivateStorageAdapter());

  it("is empty before anything is written, and creates nothing", async () => {
    expect(await history().events()).toEqual([]);
    await expect(readFile(join(root, "ledger", "consents.jsonl"), "utf8")).rejects.toThrow();
  });

  it("is appended to, one event a line, and read back in order", async () => {
    const events = [
      { clone: CLONE, state: "on", at: "2026-10-01T00:00:00.000Z" },
      { clone: CLONE, state: "off", at: "2026-10-02T00:00:00.000Z" },
    ] as const;
    for (const event of events) await history().append(event);
    expect(await history().events()).toEqual(events);
    const lines = (await readFile(join(root, "ledger", "consents.jsonl"), "utf8")).split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[2]).toBe("");
  });

  it("skips a line that is not exactly an event, and keeps the rest", async () => {
    await history().append({ clone: CLONE, state: "on", at: "2026-10-01T00:00:00.000Z" });
    const file = join(root, "ledger", "consents.jsonl");
    await writeFile(
      file,
      `${await readFile(file, "utf8")}{broken\n${JSON.stringify({ clone: CLONE, state: "maybe", at: "2026-10-02T00:00:00.000Z" })}\n`
    );
    await history().append({ clone: CLONE, state: "off", at: "2026-10-03T00:00:00.000Z" });
    expect((await history().events()).map((event) => event.state)).toEqual(["on", "off"]);
  });
});
