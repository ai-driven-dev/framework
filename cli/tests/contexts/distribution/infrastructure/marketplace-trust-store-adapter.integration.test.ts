import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarketplaceTrustStoreAdapter } from "../../../../src/contexts/distribution/infrastructure/marketplace-trust-store-adapter.js";
import type { PluginSource } from "../../../../src/shared/domain/source.js";
import { PrivateStorageAdapter } from "../../../../src/shared/infrastructure/private-storage-adapter.js";
import type { PrivateStorage } from "../../../../src/shared/ports/private-storage.js";

const githubSource: PluginSource = { kind: "github", repo: "owner/repo" };
const posix = process.platform === "win32" ? it.skip : it;

/** The real storage, noting which paths went through it. */
function watched(): { storage: PrivateStorage; replaced: string[]; read: string[] } {
  const real = new PrivateStorageAdapter();
  const replaced: string[] = [];
  const read: string[] = [];
  const storage: PrivateStorage = {
    ensureDirectory: (path) => real.ensureDirectory(path),
    replace: (path, content) => {
      replaced.push(path);
      return real.replace(path, content);
    },
    append: (path, content) => real.append(path, content),
    read: (path) => {
      read.push(path);
      return real.read(path);
    },
  };
  return { storage, replaced, read };
}

// What trust promises whatever holds it is in `ports/marketplace-trust-store.contract`;
// what stays here is the file it is written to.
describe("MarketplaceTrustStoreAdapter", () => {
  let projectRoot: string;
  let store: MarketplaceTrustStoreAdapter;

  const readTrustFile = async (): Promise<{ version: number; trusted: unknown[] }> =>
    JSON.parse(
      await readFile(join(projectRoot, ".aidd", "cache", "trusted-marketplaces.json"), "utf-8")
    );

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "trust-store-test-"));
    store = new MarketplaceTrustStoreAdapter(new PrivateStorageAdapter());
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("creates the cache directory and persists the trust file", async () => {
    await store.trust(projectRoot, githubSource);

    const parsed = await readTrustFile();
    expect(parsed.version).toBe(1);
    expect(parsed.trusted).toHaveLength(1);
  });

  it("is idempotent: calling twice does not duplicate", async () => {
    await store.trust(projectRoot, githubSource);
    await store.trust(projectRoot, githubSource);

    expect((await readTrustFile()).trusted).toHaveLength(1);
  });

  const trustFile = (): string => join(projectRoot, ".aidd", "cache", "trusted-marketplaces.json");

  it("writes and reads the trust file through the private storage", async () => {
    const { storage, replaced, read } = watched();
    const watchedStore = new MarketplaceTrustStoreAdapter(storage);

    await watchedStore.trust(projectRoot, githubSource);
    await watchedStore.isTrusted(projectRoot, githubSource);

    expect(replaced).toEqual([trustFile()]);
    expect(read).toEqual([trustFile(), trustFile()]);
  });

  posix("leaves the trust file readable by its owner alone", async () => {
    await store.trust(projectRoot, githubSource);

    expect((await stat(trustFile())).mode & 0o777).toBe(0o600);
  });

  posix("tightens a trust file that was left with a wider mode", async () => {
    await mkdir(join(projectRoot, ".aidd", "cache"), { recursive: true });
    await writeFile(trustFile(), JSON.stringify({ version: 1, trusted: [] }));
    await chmod(trustFile(), 0o644);

    await store.trust(projectRoot, githubSource);

    expect((await stat(trustFile())).mode & 0o777).toBe(0o600);
  });
});
