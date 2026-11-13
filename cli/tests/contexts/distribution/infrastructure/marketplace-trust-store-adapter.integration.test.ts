import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarketplaceTrustStoreAdapter } from "../../../../src/contexts/distribution/infrastructure/marketplace-trust-store-adapter.js";
import { HasherAdapter } from "../../../../src/contexts/framework/infrastructure/hasher-adapter.js";
import type { PluginSource } from "../../../../src/shared/domain/source.js";

const githubSource: PluginSource = { kind: "github", repo: "owner/repo" };

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
    store = new MarketplaceTrustStoreAdapter(new HasherAdapter());
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
});
