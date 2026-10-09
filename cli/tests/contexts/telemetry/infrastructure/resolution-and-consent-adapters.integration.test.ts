import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConsentSourceAdapter } from "../../../../src/contexts/telemetry/infrastructure/consent-source-adapter.js";
import { ResolutionStoreAdapter } from "../../../../src/contexts/telemetry/infrastructure/resolution-store-adapter.js";
import { PrivateStorageAdapter } from "../../../../src/runtime/filesystem/private-storage-adapter.js";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aidd-resolutions-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("the remembered resolutions", () => {
  it("are kept in roots.json beside the ledger, and read back", async () => {
    const store = new ResolutionStoreAdapter(join(root, "ledger"), new PrivateStorageAdapter());
    expect((await store.load()).size).toBe(0);
    const resolutions = new Map([["/a", { repository_id: "id", root: "/a", consented: true }]]);
    await store.save(resolutions);
    expect(await store.load()).toEqual(resolutions);
    expect(JSON.parse(await readFile(join(root, "ledger", "roots.json"), "utf8"))).toHaveProperty(
      "/a"
    );
  });
});

describe("a project's consent file", () => {
  it("is .aidd/config.json at the root", async () => {
    await mkdir(join(root, ".aidd"));
    await writeFile(join(root, ".aidd", "config.json"), '{"telemetry":{}}');
    expect(await new ConsentSourceAdapter().read(root)).toBe('{"telemetry":{}}');
  });

  it("is none when the project has no such file", async () => {
    expect(await new ConsentSourceAdapter().read(root)).toBeNull();
  });
});
