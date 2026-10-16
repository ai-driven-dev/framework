import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PersonIdentityAdapter } from "../../../../../src/contexts/telemetry/infrastructure/identity/person-identity-adapter.js";
import { PrivateStorageAdapter } from "../../../../../src/runtime/filesystem/private-storage-adapter.js";

let root: string;
let dir: string;
let store: PersonIdentityAdapter;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aidd-identity-"));
  dir = join(root, "telemetry");
  store = new PersonIdentityAdapter(dir, new PrivateStorageAdapter());
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("the person's identity file", () => {
  it("is absent until one is written", async () => {
    expect(await store.read()).toBeNull();
    expect(await store.remove()).toBe(false);
  });

  it("is written as identity.json in the telemetry directory and read back", async () => {
    await store.write("person-a");
    expect(await readFile(join(dir, "identity.json"), "utf8")).toBe('{"person_id":"person-a"}\n');
    expect(await store.read()).toBe("person-a");
  });

  it("is replaced by a new one, never merged with the old", async () => {
    await store.write("person-a");
    await store.write("person-b");
    expect(await readFile(join(dir, "identity.json"), "utf8")).toBe('{"person_id":"person-b"}\n');
  });

  it.skipIf(process.platform === "win32")("is readable by its owner alone", async () => {
    await store.write("person-a");
    expect((await stat(join(dir, "identity.json"))).mode & 0o777).toBe(0o600);
    expect((await stat(dir)).mode & 0o777).toBe(0o700);
  });

  it("is removed on request, and says whether there was one", async () => {
    await store.write("person-a");
    expect(await store.remove()).toBe(true);
    expect(await store.read()).toBeNull();
    expect(await store.remove()).toBe(false);
  });

  it("is not read from a file shaped like the previous version's", async () => {
    await store.write("seed");
    await writeFile(join(dir, "identity.json"), '{"person_id":"old","origin":"prompt"}\n');
    expect(await store.read()).toBeNull();
  });

  it("never looks above its own directory", async () => {
    await writeFile(join(root, "identity.json"), '{"person_id":"old"}\n');
    expect(await store.read()).toBeNull();
  });
});
