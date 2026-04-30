import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarketplaceRegisterFrameworkUseCase } from "../../../../src/application/use-cases/marketplace/marketplace-register-framework-use-case.js";
import { Manifest } from "../../../../src/domain/models/manifest.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../../src/domain/models/marketplace.js";
import { ManifestRepositoryAdapter } from "../../../../src/infrastructure/adapters/manifest-repository-adapter.js";
import { MarketplaceRegistryAdapter } from "../../../../src/infrastructure/adapters/marketplace-registry-adapter.js";

describe("MarketplaceRegisterFrameworkUseCase", () => {
  let projectRoot: string;
  let homeDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "register-framework-project-"));
    homeDir = await mkdtemp(join(tmpdir(), "register-framework-home-"));
    originalHome = process.env.HOME;
    process.env.HOME = homeDir;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await rm(projectRoot, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  });

  async function withManifestRepo(repo: string | undefined) {
    const manifestRepo = new ManifestRepositoryAdapter(projectRoot);
    if (repo !== undefined) {
      await manifestRepo.save(Manifest.create().withRepo(repo));
    }
    return manifestRepo;
  }

  it("registers using github source when mode is remote", async () => {
    const manifestRepo = new ManifestRepositoryAdapter(projectRoot);
    const manifest = Manifest.create().withRepo("ai-driven-dev/aidd-framework");
    manifest.setMode("remote");
    await manifestRepo.save(manifest);
    const registry = new MarketplaceRegistryAdapter();
    const useCase = new MarketplaceRegisterFrameworkUseCase(manifestRepo, registry);

    const result = await useCase.execute({ projectRoot });

    expect(result.registered).toBe(true);
    const list = await registry.list(projectRoot);
    expect(list[0]?.name).toBe(FRAMEWORK_MARKETPLACE_NAME);
    expect(list[0]?.scope).toBe("project");
    expect(list[0]?.source.kind).toBe("github");
    if (list[0]?.source.kind === "github") {
      expect(list[0]?.source.repo).toBe("ai-driven-dev/aidd-framework");
    }
  });

  it("local mode always uses relative dot regardless of install path", async () => {
    const manifestRepo = await withManifestRepo(undefined);
    const registry = new MarketplaceRegistryAdapter();
    const useCase = new MarketplaceRegisterFrameworkUseCase(manifestRepo, registry);

    const result = await useCase.execute({ projectRoot });

    expect(result.registered).toBe(true);
    const list = await registry.list(projectRoot);
    expect(list[0]?.source).toEqual({ kind: "local", path: "." });
  });

  it("is idempotent — does not duplicate when called twice", async () => {
    const manifestRepo = await withManifestRepo("x/y");
    const registry = new MarketplaceRegistryAdapter();
    const useCase = new MarketplaceRegisterFrameworkUseCase(manifestRepo, registry);

    const first = await useCase.execute({ projectRoot });
    const second = await useCase.execute({ projectRoot });

    expect(first.registered).toBe(true);
    expect(second.registered).toBe(false);
    expect(await registry.list(projectRoot)).toHaveLength(1);
  });
});
