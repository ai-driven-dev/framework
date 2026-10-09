import "../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { PluginDistributionLoader } from "../../../../../src/contexts/framework/application/plugin/plugin-distribution-loader.js";
import { PluginUpdateUseCase } from "../../../../../src/contexts/framework/application/plugin/plugin-update-use-case.js";
import { PublishRulesUseCase } from "../../../../../src/contexts/framework/application/publish-rules-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { ManifestRepositoryAdapter } from "../../../../../src/contexts/framework/infrastructure/manifest-repository-adapter.js";
import { PluginDistribution } from "../../../../../src/contexts/translate/domain/plugin-distribution.js";
import { InstallationFile } from "../../../../../src/kernel/file.js";
import { FileAdapter } from "../../../../../src/runtime/filesystem/file-adapter.js";
import { HasherAdapter } from "../../../../../src/runtime/filesystem/hasher-adapter.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";

function distribution(version: string, content: string): PluginDistribution {
  const rules = [{ relativePath: "rules/new.md", content }];
  const agents = [{ relativePath: "agents/new.md", content: "New agent" }];
  return new PluginDistribution({
    manifest: { name: "demo", version },
    format: "claude",
    files: [...rules, ...agents],
    components: { rules, agents, commands: [], skills: [], hooks: [], mcp: [] },
  });
}

describe("OpenCode plugin rule replacement preflight", () => {
  let root: string;
  const hasher = new HasherAdapter();
  const fs = new FileAdapter(hasher);
  let repo: ManifestRepositoryAdapter;
  let registry: InMemoryMarketplaceRegistry;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "aidd-rule-update-safety-"));
    repo = new ManifestRepositoryAdapter(root);
    registry = new InMemoryMarketplaceRegistry();
    const files = [
      new InstallationFile({
        relativePath: ".opencode/rules/demo/old.md",
        content: "Old active rule",
        hash: hasher.hash("Old active rule"),
      }),
      new InstallationFile({
        relativePath: ".opencode/agents/demo/old.md",
        content: "Old agent",
        hash: hasher.hash("Old agent"),
      }),
    ];
    for (const file of files) await fs.writeFile(join(root, file.relativePath), file.content);
    await fs.writeFile(join(root, "AGENTS.md"), "User guidance\r\n");
    await fs.writeFile(join(root, "opencode.jsonc"), '// preserve comments\n{"mcp": {}}\n');
    const manifest = Manifest.create();
    manifest.addTool("opencode", "1.0.0", []);
    manifest.addPlugin(
      "opencode",
      InstalledPlugin.fromDistribution(
        distribution("1.0.0", "Old active rule"),
        { kind: "local", path: "/plugin-source" },
        files,
        "project",
        new Map(),
        "catalogue"
      )
    );
    await repo.save(manifest);
    await new PublishRulesUseCase(fs).execute({ toolId: "opencode", projectRoot: root });
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function registerCatalogue(): Promise<void> {
    await registry.save(
      root,
      Marketplace.create({
        name: "catalogue",
        source: { kind: "local", path: "/catalogue" },
        scope: "project",
        addedAt: "2026-10-08T00:00:00.000Z",
      })
    );
  }

  function update(content: string): Promise<string[]> {
    const loader = new PluginDistributionLoader(
      { fetch: async () => "/plugin-source" },
      { read: async () => distribution("2.0.0", content) }
    );
    return new PluginUpdateUseCase(fs, repo, loader, hasher, {
      marketplaceRegistry: registry,
      ensureBuilt: fakeEnsureBuiltMarketplace(() => join(root, ".aidd/built")),
      homedir: () => "/isolated-home",
    }).execute({ toolIds: ["opencode"], projectRoot: root });
  }

  it.each([false, true])(
    "refuses an unsafe replacement before deleting prior files (catalogue present: %s)",
    async (present) => {
      if (present) await registerCatalogue();
      const before = new Map<string, string>();
      for (const path of await fs.listDirectory(root))
        before.set(path, await fs.readFile(join(root, path)));
      await expect(update("<!-- aidd_opencode_rules:end -->")).rejects.toThrow(/Unsafe/);
      expect(await fs.readFile(repo.path)).toBe(before.get(".aidd/manifest.json"));
      expect((await fs.listDirectory(root)).sort()).toEqual([...before.keys()].sort());
      for (const [path, content] of before)
        expect(await fs.readFile(join(root, path)), path).toBe(content);
    }
  );

  it("publishes only the resolved build's actual files, never a skipped canonical rule", async () => {
    await registerCatalogue();
    await fs.writeFile(join(root, ".aidd/built/.opencode/agents/demo-new.md"), "Built agent bytes");
    await expect(update("Skipped canonical rule marker")).resolves.toEqual(["demo"]);
    expect(await fs.readFile(join(root, "AGENTS.md"))).toBe("User guidance\r\n");
    expect(await fs.readFile(join(root, ".opencode/agents/demo-new.md"))).toBe("Built agent bytes");
    expect(await fs.fileExists(join(root, ".opencode/rules/demo/old.md"))).toBe(false);
    expect(await fs.fileExists(join(root, ".opencode/rules/new.md"))).toBe(false);
    const plugin = (await repo.load())?.getPlugins("opencode")[0];
    expect(plugin?.version).toBe("2.0.0");
    expect([...(plugin?.files.keys() ?? [])]).toEqual([".opencode/agents/demo-new.md"]);
  });
});
