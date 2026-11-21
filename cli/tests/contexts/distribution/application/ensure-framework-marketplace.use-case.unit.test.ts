import { describe, expect, it } from "vitest";
import type { TokenProvider } from "../../../../src/contexts/auth/contract/token-provider.js";
import { EnsureFrameworkMarketplace } from "../../../../src/contexts/distribution/application/ensure-framework-marketplace.use-case.js";
import { RegisterFrameworkMarketplace } from "../../../../src/contexts/distribution/application/register-framework-marketplace.use-case.js";
import {
  localFrameworkSource,
  remoteFrameworkSource,
} from "../../../../src/contexts/distribution/contract/framework-source.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../../src/contexts/distribution/contract/marketplace.js";
import type { RepositoryVisibility } from "../../../../src/contexts/distribution/ports/repository-visibility.js";
import { CatalogFetchAuthError } from "../../../../src/shared/domain/shared.error.js";
import { InMemoryMarketplaceRegistry } from "../../../shared/testing/in-memory-marketplace-registry.fake.js";

const PROJECT = "/project";
const withToken = { resolve: async () => "token" };
const withoutToken = { resolve: async () => null };
const publicRepos = { isRepoPublic: async () => true };
const privateRepos = { isRepoPublic: async () => false };

function ensureOver(
  registry: InMemoryMarketplaceRegistry,
  tokenProvider: TokenProvider = withToken,
  releaseResolver: RepositoryVisibility = privateRepos
): EnsureFrameworkMarketplace {
  return new EnsureFrameworkMarketplace(
    new RegisterFrameworkMarketplace(registry),
    tokenProvider,
    releaseResolver
  );
}

describe("EnsureFrameworkMarketplace", () => {
  it("registers the framework marketplace from the source and names where it landed", async () => {
    const registry = new InMemoryMarketplaceRegistry();

    const ensured = await ensureOver(registry).execute({
      projectRoot: PROJECT,
      source: localFrameworkSource("/framework"),
    });

    expect(ensured).toEqual({ name: FRAMEWORK_MARKETPLACE_NAME, scope: "user" });
    expect((await registry.list(PROJECT)).map((m) => [m.name, m.source])).toEqual([
      [FRAMEWORK_MARKETPLACE_NAME, { kind: "local", path: "/framework" }],
    ]);
  });

  it("replaces a registration that already points elsewhere", async () => {
    const registry = new InMemoryMarketplaceRegistry();
    const ensure = ensureOver(registry);
    await ensure.execute({ projectRoot: PROJECT, source: localFrameworkSource("/old") });

    await ensure.execute({ projectRoot: PROJECT, source: localFrameworkSource("/new") });

    expect((await registry.list(PROJECT)).map((m) => m.source)).toEqual([
      { kind: "local", path: "/new" },
    ]);
  });

  it("lets a remote source through with a token", async () => {
    const registry = new InMemoryMarketplaceRegistry();

    await ensureOver(registry, withToken, privateRepos).execute({
      projectRoot: PROJECT,
      source: remoteFrameworkSource("owner/repo"),
    });

    expect(await registry.list(PROJECT)).toHaveLength(1);
  });

  it("lets a public remote source through without a token", async () => {
    const registry = new InMemoryMarketplaceRegistry();

    await ensureOver(registry, withoutToken, publicRepos).execute({
      projectRoot: PROJECT,
      source: remoteFrameworkSource("owner/repo"),
    });

    expect(await registry.list(PROJECT)).toHaveLength(1);
  });

  it("refuses a private remote source without a token and registers nothing", async () => {
    const registry = new InMemoryMarketplaceRegistry();

    await expect(
      ensureOver(registry, withoutToken, privateRepos).execute({
        projectRoot: PROJECT,
        source: remoteFrameworkSource("owner/repo"),
      })
    ).rejects.toBeInstanceOf(CatalogFetchAuthError);
    expect(await registry.list(PROJECT)).toEqual([]);
  });

  it("asks no credentials of a local source", async () => {
    const registry = new InMemoryMarketplaceRegistry();

    await ensureOver(registry, withoutToken, privateRepos).execute({
      projectRoot: PROJECT,
      source: localFrameworkSource("/framework"),
    });

    expect(await registry.list(PROJECT)).toHaveLength(1);
  });
});
