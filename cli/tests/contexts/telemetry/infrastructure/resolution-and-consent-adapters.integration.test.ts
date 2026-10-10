import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
    expect(await history().read()).toEqual({ events: [], damaged: false });
    await expect(readFile(join(root, "ledger", "consents.jsonl"), "utf8")).rejects.toThrow();
  });

  it("is appended to, one event a line, and read back in order", async () => {
    const events = [
      { kind: "open", token: "t1", clone: CLONE, at: "2026-10-01T00:00:00.000Z" },
      { kind: "close", token: "t1", at: "2026-10-02T00:00:00.000Z" },
    ] as const;
    for (const event of events) await history().append(event);
    expect(await history().read()).toEqual({ events, damaged: false });
    const lines = (await readFile(join(root, "ledger", "consents.jsonl"), "utf8")).split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[2]).toBe("");
  });

  it("drops a last line a crash left unterminated before the next event, so it is never terminated into damage", async () => {
    const file = join(root, "ledger", "consents.jsonl");
    await history().append({
      kind: "open",
      token: "t1",
      clone: CLONE,
      at: "2026-10-01T00:00:00.000Z",
    });
    await appendFile(file, '{"token":"t1","clo');
    expect(await history().read()).toMatchObject({ damaged: false });
    await history().append({ kind: "close", token: "t1", at: "2026-10-02T00:00:00.000Z" });
    const records = await history().read();
    expect(records.damaged).toBe(false);
    expect(records.events.map((event) => event.kind)).toEqual(["open", "close"]);
    const lines = (await readFile(file, "utf8")).split("\n").filter(Boolean);
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(() => JSON.parse(line)).not.toThrow();
  });

  it("says a line that is not exactly an event damaged the file, and still reads the rest", async () => {
    await history().append({
      kind: "open",
      token: "t1",
      clone: CLONE,
      at: "2026-10-01T00:00:00.000Z",
    });
    const file = join(root, "ledger", "consents.jsonl");
    await writeFile(file, `${await readFile(file, "utf8")}{broken\n`);
    await history().append({ kind: "close", token: "t1", at: "2026-10-03T00:00:00.000Z" });
    const records = await history().read();
    expect(records.damaged).toBe(true);
    expect(records.events.map((event) => event.kind)).toEqual(["open", "close"]);
  });

  it("reads a line another process appended, the hooks among them, in the format they write", async () => {
    await history().append({
      kind: "open",
      token: "t1",
      clone: CLONE,
      at: "2026-10-01T00:00:00.000Z",
    });
    const file = join(root, "ledger", "consents.jsonl");
    await writeFile(
      file,
      `${await readFile(file, "utf8")}{"token":"t1","close":"2026-10-02T00:00:00.000Z"}\n`
    );
    expect((await history().read()).events.at(-1)).toEqual({
      kind: "close",
      token: "t1",
      at: "2026-10-02T00:00:00.000Z",
    });
  });
});
