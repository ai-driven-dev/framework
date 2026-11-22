import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../../src/contexts/distribution/contract/marketplace.js";
import {
  MarketplaceNotFoundError,
  SharedMarketplaceRemovalError,
} from "../../../../src/contexts/distribution/domain/distribution.error.js";
import { Marketplace } from "../../../../src/contexts/distribution/domain/marketplace.js";
import { RemoveProjectPlugin } from "../../../../src/contexts/installation/application/removal/remove-project-plugin.js";
import { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { saying } from "../../../shared/testing/saying.builder.js";
import { KeepPrompter } from "../../../shared/testing/scripted-prompter.fake.js";
import {
  SYNTHETIC_USER_TOOL,
  syntheticNativeFamilyCatalog,
} from "../../../shared/testing/synthetic-native-tool.builder.js";
import {
  SYNTHETIC_TOOL,
  syntheticCatalog,
} from "../../../shared/testing/synthetic-tool-id.builder.js";
import {
  buildUseCase,
  marketplaceNamed,
  PROJECT_ROOT,
} from "../../testing/project-marketplace-removal.builder.js";
import { projectMarketplaceRemover } from "../../testing/project-marketplace-remover.builder.js";

describe("removing a project marketplace", () => {
  it("throws MarketplaceNotFoundError when entry does not exist", async () => {
    const { useCase, registry } = buildUseCase(syntheticCatalog());
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "present",
        source: { kind: "local", path: "/tmp/whatever" },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );
    await expect(
      useCase.execute({
        name: "missing",
        projectRoot: PROJECT_ROOT,
        autoConfirm: true,
      })
    ).rejects.toThrow(MarketplaceNotFoundError);
  });

  it("removes registry entry when no orphans tracked", async () => {
    const { useCase, registry } = buildUseCase(syntheticCatalog());
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "awesome",
        source: { kind: "local", path: "/tmp/whatever" },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      autoConfirm: true,
    });

    expect(result.removedPluginCount).toBe(0);
    expect(await registry.list(PROJECT_ROOT)).toEqual([]);
  });

  it("removes orphan plugins and their files when autoConfirm is true", async () => {
    const { useCase, registry, manifestRepo, fs } = buildUseCase(syntheticCatalog());
    const manifest = Manifest.create();
    manifest.addTool(SYNTHETIC_TOOL, "1.0.0", []);
    const plugin = RecordedPlugin.fromJSON({
      name: "sample",
      source: { kind: "github", repo: "owner/sample" },
      version: "1.0.0",
      strict: false,
      files: { ".synthetic/plugins/sample/note.md": "0123456789abcdef0123456789abcdef" },
      scope: "project",
      marketplace: "awesome",
    });
    manifest.addPlugin(SYNTHETIC_TOOL, plugin);
    await manifestRepo.save(manifest);

    const filePath = join(PROJECT_ROOT, ".synthetic/plugins/sample/note.md");
    await fs.writeFile(filePath, "content");

    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "awesome",
        source: { kind: "github", repo: "owner/awesome" },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      autoConfirm: true,
    });

    expect(result.removedPluginCount).toBe(1);
    expect(fs.has(filePath)).toBe(false);
    const reloaded = await manifestRepo.load();
    expect(reloaded?.getPlugins(SYNTHETIC_TOOL)).toHaveLength(0);
  });

  it("removes a project marketplace's orphan projection without deleting shared user-scope files", async () => {
    const { registry, manifestRepo, fs } = buildUseCase(syntheticNativeFamilyCatalog());
    const useCase = projectMarketplaceRemover(
      syntheticNativeFamilyCatalog(),
      new RemoveProjectPlugin(fs, () => "/home/dev"),
      manifestRepo,
      registry,
      new KeepPrompter()
    );
    const manifest = Manifest.create();
    manifest.addTool(SYNTHETIC_USER_TOOL, "1.0.0", []);
    const pluginKey = "aidd-context/commands/hello.md";
    manifest.addPlugin(
      SYNTHETIC_USER_TOOL,
      RecordedPlugin.fromJSON({
        name: "aidd-context",
        source: { kind: "github", repo: "owner/aidd-context" },
        version: "1.0.0",
        strict: false,
        files: { [pluginKey]: "0123456789abcdef0123456789abcdef" },
        scope: "user",
        marketplace: "awesome",
      })
    );
    await manifestRepo.save(manifest);

    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "awesome",
        source: { kind: "github", repo: "owner/awesome" },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      autoConfirm: true,
    });

    expect(result.removedPluginCount).toBe(1);
    expect(
      fs.deletedPaths.some((p) =>
        p.endsWith(join(`.${SYNTHETIC_USER_TOOL}`, "plugins", "local", pluginKey))
      )
    ).toBe(false);
    expect(fs.deletedPaths).not.toContain(join(PROJECT_ROOT, pluginKey));
  });

  it("removes a user-scope tool orphan's file under projectRoot, not the home plugins directory, when the manifest says scope: project", async () => {
    const { registry, manifestRepo, fs } = buildUseCase(syntheticNativeFamilyCatalog());
    const useCase = projectMarketplaceRemover(
      syntheticNativeFamilyCatalog(),
      new RemoveProjectPlugin(fs, () => "/home/dev"),
      manifestRepo,
      registry,
      new KeepPrompter()
    );
    const manifest = Manifest.create();
    manifest.addTool(SYNTHETIC_USER_TOOL, "1.0.0", []);
    const pluginKey = "aidd-context/commands/hello.md";
    manifest.addPlugin(
      SYNTHETIC_USER_TOOL,
      RecordedPlugin.fromJSON({
        name: "aidd-context",
        source: { kind: "github", repo: "owner/aidd-context" },
        version: "1.0.0",
        strict: false,
        files: { [pluginKey]: "0123456789abcdef0123456789abcdef" },
        // Disagrees with the tool's own profile, which declares installScope "user".
        scope: "project",
        marketplace: "awesome",
      })
    );
    await manifestRepo.save(manifest);

    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: "awesome",
        source: { kind: "github", repo: "owner/awesome" },
        scope: "project",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    const result = await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      autoConfirm: true,
    });

    expect(result.removedPluginCount).toBe(1);
    expect(fs.deletedPaths).toContain(join(PROJECT_ROOT, pluginKey));
    expect(
      fs.deletedPaths.some((p) => p.includes(join(`.${SYNTHETIC_USER_TOOL}`, "plugins", "local")))
    ).toBe(false);
  });

  // `aidd-framework` is machine-scope: removing it from one project would orphan the host's
  // own registration for every other project. `marketplace add` already refuses that name.
  it("refuses to remove the reserved aidd-framework marketplace, leaving the registry untouched", async () => {
    const { useCase, registry } = buildUseCase(syntheticCatalog());
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: FRAMEWORK_MARKETPLACE_NAME,
        source: { kind: "local", path: "." },
        scope: "user",
        addedAt: "2026-04-29T10:00:00.000Z",
      })
    );

    await expect(
      useCase.execute({
        name: FRAMEWORK_MARKETPLACE_NAME,
        projectRoot: PROJECT_ROOT,
        autoConfirm: true,
      })
    ).rejects.toThrow(SharedMarketplaceRemovalError);

    const list = await registry.list(PROJECT_ROOT);
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe(FRAMEWORK_MARKETPLACE_NAME);
  });

  it("refuses the reserved name with a message naming the command that does remove it", async () => {
    const { useCase } = buildUseCase(syntheticCatalog());

    await expect(
      useCase.execute({
        name: FRAMEWORK_MARKETPLACE_NAME,
        projectRoot: PROJECT_ROOT,
        autoConfirm: true,
      })
    ).rejects.toThrow(
      saying(
        "is shared by every project on this machine and is not removed with `aidd marketplace remove` — it is removed with the framework itself, by `aidd clean`, once machine scope lands there."
      )
    );
  });
});

describe("which marketplace a removal takes out", () => {
  it("removes the named marketplace, never the first one registered", async () => {
    const { useCase, registry } = buildUseCase(syntheticCatalog());
    await registry.save(PROJECT_ROOT, marketplaceNamed("alpha"));
    const awesome = marketplaceNamed("awesome");
    await registry.save(PROJECT_ROOT, awesome);

    const result = await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      autoConfirm: true,
    });

    expect(result).toStrictEqual({
      marketplace: { name: "awesome", scope: "project" },
      removedPluginCount: 0,
      orphanCount: 0,
    });
    expect((await registry.list(PROJECT_ROOT)).map((m) => m.name)).toStrictEqual(["alpha"]);
  });

  it("reports zero orphans when the project has no manifest at all", async () => {
    const { useCase, registry } = buildUseCase(syntheticCatalog());
    const awesome = marketplaceNamed("awesome");
    await registry.save(PROJECT_ROOT, awesome);

    const result = await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      autoConfirm: true,
    });

    expect(result).toStrictEqual({
      marketplace: { name: "awesome", scope: "project" },
      removedPluginCount: 0,
      orphanCount: 0,
    });
  });
});
