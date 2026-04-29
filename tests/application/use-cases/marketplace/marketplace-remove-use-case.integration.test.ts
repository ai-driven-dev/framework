import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../../../../src/domain/tools/ai/claude.js";
import { MarketplaceRemoveUseCase } from "../../../../src/application/use-cases/marketplace/marketplace-remove-use-case.js";
import { MarketplaceNotFoundError } from "../../../../src/domain/errors.js";
import { Manifest } from "../../../../src/domain/models/manifest.js";
import { Marketplace } from "../../../../src/domain/models/marketplace.js";
import { Plugin } from "../../../../src/domain/models/plugin.js";
import { FileSystemAdapter } from "../../../../src/infrastructure/adapters/file-system-adapter.js";
import { HasherAdapter } from "../../../../src/infrastructure/adapters/hasher-adapter.js";
import { ManifestRepositoryAdapter } from "../../../../src/infrastructure/adapters/manifest-repository-adapter.js";
import { MarketplaceRegistryAdapter } from "../../../../src/infrastructure/adapters/marketplace-registry-adapter.js";
import { KeepPrompter } from "../helpers.js";

describe("MarketplaceRemoveUseCase", () => {
  let projectRoot: string;
  let homeDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "mkt-remove-project-"));
    homeDir = await mkdtemp(join(tmpdir(), "mkt-remove-home-"));
    originalHome = process.env.HOME;
    process.env.HOME = homeDir;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await rm(projectRoot, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  });

  function buildUseCase(): {
    useCase: MarketplaceRemoveUseCase;
    registry: MarketplaceRegistryAdapter;
    manifestRepo: ManifestRepositoryAdapter;
    fs: FileSystemAdapter;
  } {
    const hasher = new HasherAdapter();
    const fs = new FileSystemAdapter(hasher);
    const manifestRepo = new ManifestRepositoryAdapter(projectRoot);
    const registry = new MarketplaceRegistryAdapter();
    const useCase = new MarketplaceRemoveUseCase(fs, manifestRepo, registry, new KeepPrompter());
    return { useCase, registry, manifestRepo, fs };
  }

  it("throws MarketplaceNotFoundError when entry does not exist", async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.execute({ name: "missing", projectRoot, autoConfirm: true })
    ).rejects.toThrow(MarketplaceNotFoundError);
  });

  it("removes registry entry when no orphans tracked", async () => {
    const { useCase, registry } = buildUseCase();
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "awesome",
        source: { kind: "local", path: "/tmp/whatever" },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      name: "awesome",
      projectRoot,
      autoConfirm: true,
    });

    expect(result.removedPluginCount).toBe(0);
    expect(await registry.list(projectRoot)).toEqual([]);
  });

  it("removes orphan plugins and their files when autoConfirm is true", async () => {
    const { useCase, registry, manifestRepo, fs } = buildUseCase();
    const manifest = Manifest.create();
    manifest.addTool("claude", "1.0.0", []);
    const plugin = Plugin.fromJSON({
      name: "sample",
      source: { kind: "github", repo: "owner/sample" },
      version: "1.0.0",
      strict: false,
      files: { ".claude/plugins/sample/CLAUDE.md": "0123456789abcdef0123456789abcdef" },
      marketplace: "awesome",
    });
    manifest.addPlugin("claude", plugin);
    await manifestRepo.save(manifest);
    const filePath = join(projectRoot, ".claude/plugins/sample/CLAUDE.md");
    await mkdir(join(projectRoot, ".claude/plugins/sample"), { recursive: true });
    await writeFile(filePath, "content");
    await registry.save(
      projectRoot,
      Marketplace.create({
        name: "awesome",
        source: { kind: "github", repo: "owner/awesome" },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      name: "awesome",
      projectRoot,
      autoConfirm: true,
    });

    expect(result.removedPluginCount).toBe(1);
    expect(await fs.fileExists(filePath)).toBe(false);
    const reloaded = await manifestRepo.load();
    expect(reloaded?.getPlugins("claude")).toHaveLength(0);
  });
});
