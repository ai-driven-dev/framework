import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResolveMarketplaceUseCase } from "../../../src/contexts/distribution/application/resolve-marketplace-use-case.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { MarketplaceRegistryAdapter } from "../../../src/contexts/distribution/infrastructure/marketplace-registry-adapter.js";
import { PluginFetcherAdapter } from "../../../src/contexts/distribution/infrastructure/plugin-fetcher-adapter.js";
import { PluginInstallFromMarketplaceUseCase } from "../../../src/contexts/framework/application/plugin/plugin-install-from-marketplace-use-case.js";
import { EnsureBuiltMarketplaceUseCase } from "../../../src/contexts/framework/application/shared/ensure-built-marketplace-use-case.js";
import { Manifest } from "../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { FileHash, InstallationFile } from "../../../src/kernel/file.js";
import { GitHubReleaseResolverAdapter } from "../../../src/runtime/self-update/github-release-resolver-adapter.js";
import { createDeps } from "../../../src/runtime/wiring/framework.js";

const hash = (content: string) => createHash("md5").update(content).digest("hex");

describe("framework release update wiring", () => {
  let root: string;
  const confirm = vi.fn(async () => true);

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "aidd-wired-upgrade-"));
    vi.stubEnv("AIDD_USER_CONFIG_DIR", join(root, "home"));
    vi.stubEnv("HOME", join(root, "home"));
    vi.stubEnv("CLAUDE_CONFIG_DIR", "");
    const cataloguePath = join(root, ".aidd/cache/built/aidd-framework/claude");
    await mkdir(cataloguePath, { recursive: true });
    const claudeRegistry = join(root, "home/.claude/plugins/known_marketplaces.json");
    await mkdir(dirname(claudeRegistry), { recursive: true });
    await writeFile(
      claudeRegistry,
      JSON.stringify({ "aidd-framework": { installLocation: cataloguePath } })
    );
    confirm.mockClear();
    const pluginManifest = join(root, "plugins/aidd-context/.claude-plugin/plugin.json");
    await mkdir(dirname(pluginManifest), { recursive: true });
    await writeFile(pluginManifest, JSON.stringify({ name: "aidd-context", version: "2.10.0" }));
    vi.spyOn(GitHubReleaseResolverAdapter.prototype, "isPublishedRelease").mockResolvedValue(true);
    vi.spyOn(ResolveMarketplaceUseCase.prototype, "execute").mockImplementation(
      async ({ marketplace }) => ({
        marketplace,
        localPath: root,
        catalog: {
          version: "5.13.0",
          plugins: [
            {
              name: "aidd-context",
              source: { kind: "local", path: "plugins/aidd-context" },
              recommended: false,
              strict: true,
            },
          ],
        },
      })
    );
    await new MarketplaceRegistryAdapter().save(
      root,
      Marketplace.fromJSON({
        name: "aidd-framework",
        source: { kind: "github", repo: "ai-driven-dev/framework", ref: "v5.12.0" },
        scope: "project",
        addedAt: "2026-01-01",
        version: "5.12.0",
      })
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  async function seed(
    toolId: "claude" | "cursor" | "opencode",
    options: { files?: Record<string, string>; mcpEntries?: Record<string, string> } = {}
  ) {
    const deps = await createDeps(root, { verbose: false });
    const manifest = Manifest.create();
    manifest.addTool(toolId, "5.6.0", []);
    const plugin = InstalledPlugin.fromMetadata(
      "aidd-context",
      "2.9.0",
      {
        kind: "git-subdir",
        url: "https://github.com/ai-driven-dev/framework.git",
        path: "plugins/aidd-context",
        ref: "v5.12.0",
      },
      true,
      "project",
      "aidd-framework"
    );
    manifest.addPlugin(toolId, InstalledPlugin.fromJSON({ ...plugin.toJSON(), ...options }));
    await deps.manifestRepo.save(manifest);
    return deps;
  }

  it.each(["user-only", "project-only", "other project's local scope"] as const)(
    "refuses Claude %s before modifying any installation",
    async (reason) => {
      const deps = await seed("claude");
      const manifest = await deps.manifestRepo.load();
      if (!manifest) throw new Error("missing project manifest");
      const ref = "aidd-context@aidd-framework";
      manifest.setNativeRegistrations("claude", {
        binary: "claude",
        marketplaces: [
          {
            alias: "aidd-framework",
            hostName: "aidd-framework",
            provenance: { kind: "registry", source: join(root, "catalogue") },
          },
        ],
        pluginRefs: [ref],
      });
      await deps.manifestRepo.save(manifest);
      const registryPath = join(root, "home/.claude/plugins/installed_plugins.json");
      await mkdir(dirname(registryPath), { recursive: true });
      const entries =
        reason === "user-only"
          ? [{ scope: "user" }]
          : reason === "project-only"
            ? [{ scope: "project", projectPath: root }]
            : [{ scope: "local", projectPath: join(root, "other") }];
      const plugins = { [ref]: entries };
      await writeFile(registryPath, JSON.stringify({ plugins }));
      const registry = join(root, ".aidd/marketplaces.json");
      const beforeRegistry = await readFile(registry, "utf8");
      const beforeManifest = JSON.stringify((await deps.manifestRepo.load())?.toJSON());
      const beforeMachine = JSON.stringify((await deps.userManifestRepo.load())?.toJSON());
      const untouched = join(root, ".claude/settings.local.json");
      await mkdir(dirname(untouched), { recursive: true });
      await writeFile(untouched, "user settings");
      const install = vi
        .spyOn(PluginInstallFromMarketplaceUseCase.prototype, "execute")
        .mockRejectedValue(new Error("installation must not start"));

      await expect(
        deps.upgradeFrameworkUseCase.execute({
          projectRoot: root,
          release: "v5.13.0",
          allowShared: false,
          confirm,
        })
      ).rejects.toThrow(/claude.*local installation was not found/i);
      expect(confirm).not.toHaveBeenCalled();
      expect(install).not.toHaveBeenCalled();
      expect(await readFile(registry, "utf8")).toBe(beforeRegistry);
      expect(JSON.stringify((await deps.manifestRepo.load())?.toJSON())).toBe(beforeManifest);
      expect(JSON.stringify((await deps.userManifestRepo.load())?.toJSON())).toBe(beforeMachine);
      expect(await readFile(untouched, "utf8")).toBe("user settings");
    }
  );

  it("accepts Claude's registered local scope for this project before confirmation", async () => {
    const deps = await seed("claude");
    const manifest = await deps.manifestRepo.load();
    if (!manifest) throw new Error("missing project manifest");
    const ref = "aidd-context@aidd-framework";
    manifest.setNativeRegistrations("claude", {
      binary: "claude",
      marketplaces: [
        {
          alias: "aidd-framework",
          hostName: "aidd-framework",
          provenance: { kind: "registry", source: join(root, "catalogue") },
        },
      ],
      pluginRefs: [ref],
    });
    await deps.manifestRepo.save(manifest);
    const registryPath = join(root, "home/.claude/plugins/installed_plugins.json");
    await mkdir(dirname(registryPath), { recursive: true });
    await writeFile(
      registryPath,
      JSON.stringify({ plugins: { [ref]: [{ scope: "local", projectPath: root }] } })
    );
    const decline = vi.fn(async () => false);
    const result = await deps.upgradeFrameworkUseCase.execute({
      projectRoot: root,
      release: "v5.13.0",
      allowShared: false,
      confirm: decline,
    });
    expect(decline).toHaveBeenCalledOnce();
    expect(result.cancelled).toBe(true);
  });

  it("shows shared Claude installations before confirmation without requiring plugin ownership claims", async () => {
    const deps = await seed("claude");
    const manifest = await deps.manifestRepo.load();
    if (!manifest) throw new Error("missing project manifest");
    const ref = "aidd-context@aidd-framework";
    manifest.setNativeRegistrations("claude", {
      binary: "claude",
      marketplaces: [
        {
          alias: "aidd-framework",
          hostName: "aidd-framework",
        },
      ],
      pluginRefs: [],
    });
    await deps.manifestRepo.save(manifest);
    const registryPath = join(root, "home/.claude/plugins/installed_plugins.json");
    await mkdir(dirname(registryPath), { recursive: true });
    await writeFile(
      registryPath,
      JSON.stringify({
        plugins: {
          [ref]: [{ scope: "local", projectPath: root }, { scope: "user" }],
          "other@aidd-framework": [{ scope: "project", projectPath: join(root, "other") }],
        },
      })
    );
    const decline = vi.fn(async () => false);
    const registry = join(root, ".aidd/marketplaces.json");
    const before = await readFile(registry, "utf8");
    const result = await deps.upgradeFrameworkUseCase.execute({
      projectRoot: root,
      release: "v5.13.0",
      allowShared: false,
      confirm: decline,
    });
    expect(result.cancelled).toBe(true);
    expect(decline).toHaveBeenCalledWith(
      expect.objectContaining({
        shared: true,
        impact: [
          { ref, scope: "local", projectPath: await realpath(root) },
          { ref, scope: "user" },
          { ref: "other@aidd-framework", scope: "project", projectPath: join(root, "other") },
        ],
      })
    );
    expect(await readFile(registry, "utf8")).toBe(before);
  });

  it("refuses a shared Claude update without shared approval or when the inventory changed", async () => {
    const deps = await seed("claude");
    const manifest = await deps.manifestRepo.load();
    if (!manifest) throw new Error("missing project manifest");
    const ref = "aidd-context@aidd-framework";
    manifest.setNativeRegistrations("claude", {
      binary: "claude",
      marketplaces: [
        {
          alias: "aidd-framework",
          hostName: "aidd-framework",
          provenance: { kind: "registry", source: join(root, "catalogue") },
        },
      ],
      pluginRefs: [],
    });
    await deps.manifestRepo.save(manifest);
    const nativeRegistry = join(root, "home/.claude/plugins/installed_plugins.json");
    await mkdir(dirname(nativeRegistry), { recursive: true });
    const plugins = { [ref]: [{ scope: "local", projectPath: root }, { scope: "user" }] };
    await writeFile(nativeRegistry, JSON.stringify({ plugins }));
    const registry = join(root, ".aidd/marketplaces.json");
    const before = await readFile(registry, "utf8");
    await expect(
      deps.upgradeFrameworkUseCase.execute({
        projectRoot: root,
        release: "v5.13.0",
        allowShared: false,
        confirm,
      })
    ).rejects.toThrow(/allow-shared/);
    expect(confirm).toHaveBeenCalledOnce();
    expect(await readFile(registry, "utf8")).toBe(before);
    await expect(
      deps.upgradeFrameworkUseCase.execute({
        projectRoot: root,
        release: "v5.13.0",
        allowShared: true,
        confirm: async () => {
          await writeFile(
            nativeRegistry,
            JSON.stringify({ plugins: { ...plugins, "new@aidd-framework": [{ scope: "user" }] } })
          );
          return true;
        },
      })
    ).rejects.toThrow(/installations changed after the preview/);
    expect(await readFile(registry, "utf8")).toBe(before);
    await writeFile(nativeRegistry, JSON.stringify({ plugins }));
    await expect(
      deps.upgradeFrameworkUseCase.execute({
        projectRoot: root,
        release: "v5.13.0",
        allowShared: true,
        confirm: async () => {
          await writeFile(
            join(root, "home/.claude/plugins/known_marketplaces.json"),
            JSON.stringify({ "aidd-framework": { installLocation: "/another/source" } })
          );
          return true;
        },
      })
    ).rejects.toThrow(/source changed after the preview/);
    expect(await readFile(registry, "utf8")).toBe(before);
  });

  it("refuses a different Claude marketplace source before any write or confirmation", async () => {
    const deps = await seed("claude");
    await writeFile(
      join(root, "home/.claude/plugins/known_marketplaces.json"),
      JSON.stringify({ "aidd-framework": { installLocation: "/different/source" } })
    );
    const manifest = await deps.manifestRepo.load();
    if (!manifest) throw new Error("missing project manifest");
    manifest.setNativeRegistrations("claude", {
      binary: "claude",
      marketplaces: [
        {
          alias: "aidd-framework",
          hostName: "aidd-framework",
          provenance: { kind: "registry", source: "/different/source" },
        },
      ],
      pluginRefs: [],
    });
    await deps.manifestRepo.save(manifest);
    const registry = join(root, ".aidd/marketplaces.json");
    const before = await readFile(registry, "utf8");
    await expect(
      deps.upgradeFrameworkUseCase.execute({
        projectRoot: root,
        release: "v5.13.0",
        allowShared: true,
        confirm,
      })
    ).rejects.toThrow(/Cannot verify Claude marketplace source/);
    expect(confirm).not.toHaveBeenCalled();
    expect(await readFile(registry, "utf8")).toBe(before);
  });

  it("refuses when both Claude's source and its recorded provenance change after preview", async () => {
    const deps = await seed("claude");
    const manifest = await deps.manifestRepo.load();
    if (!manifest) throw new Error("missing project manifest");
    const registration = {
      binary: "claude",
      marketplaces: [
        {
          alias: "aidd-framework",
          hostName: "aidd-framework",
          provenance: { kind: "registry" as const, source: join(root, "catalogue") },
        },
      ],
      pluginRefs: [],
    };
    manifest.setNativeRegistrations("claude", registration);
    await deps.manifestRepo.save(manifest);
    const nativeRegistry = join(root, "home/.claude/plugins/installed_plugins.json");
    await mkdir(dirname(nativeRegistry), { recursive: true });
    await writeFile(
      nativeRegistry,
      JSON.stringify({
        plugins: {
          "aidd-context@aidd-framework": [{ scope: "local", projectPath: root }],
        },
      })
    );
    const marketplace = join(root, ".aidd/marketplaces.json");
    const before = await readFile(marketplace, "utf8");
    const install = vi
      .spyOn(PluginInstallFromMarketplaceUseCase.prototype, "execute")
      .mockRejectedValue(new Error("installation must not start"));
    await expect(
      deps.upgradeFrameworkUseCase.execute({
        projectRoot: root,
        release: "v5.13.0",
        allowShared: true,
        confirm: async () => {
          const current = await deps.manifestRepo.load();
          if (!current) throw new Error("missing manifest");
          current.setNativeRegistrations("claude", {
            ...registration,
            marketplaces: [
              {
                ...registration.marketplaces[0],
                provenance: { kind: "registry", source: "/another/source" },
              },
            ],
          });
          await deps.manifestRepo.save(current);
          await writeFile(
            join(root, "home/.claude/plugins/known_marketplaces.json"),
            JSON.stringify({ "aidd-framework": { installLocation: "/another/source" } })
          );
          return true;
        },
      })
    ).rejects.toThrow(/source changed after the preview/);
    expect(await readFile(marketplace, "utf8")).toBe(before);
    expect(install).not.toHaveBeenCalled();
  });

  it("refuses a custom Claude config before modifying the marketplace", async () => {
    vi.stubEnv("CLAUDE_CONFIG_DIR", join(root, "custom-claude"));
    const deps = await seed("claude");
    const registry = join(root, ".aidd/marketplaces.json");
    const before = await readFile(registry, "utf8");
    await expect(
      deps.upgradeFrameworkUseCase.execute({
        projectRoot: root,
        release: "v5.13.0",
        allowShared: false,
        confirm,
      })
    ).rejects.toThrow(/custom CLAUDE_CONFIG_DIR/);
    expect(confirm).not.toHaveBeenCalled();
    expect(await readFile(registry, "utf8")).toBe(before);
  });

  async function fixtureDistribution() {
    const pluginRoot = join(root, "remote-plugin");
    const builtDir = join(root, "built");
    const rel = ".opencode/skills/aidd-context/01-demo/SKILL.md";
    const updated = "---\nname: 01-demo\ndescription: new\n---\nnew\n";
    await mkdir(join(pluginRoot, ".claude-plugin"), { recursive: true });
    await mkdir(join(pluginRoot, "skills/01-demo"), { recursive: true });
    await writeFile(
      join(pluginRoot, ".claude-plugin/plugin.json"),
      JSON.stringify({ name: "aidd-context", version: "2.10.0" })
    );
    await writeFile(join(pluginRoot, "skills/01-demo/SKILL.md"), updated);
    await mkdir(dirname(join(builtDir, rel)), { recursive: true });
    await writeFile(join(builtDir, rel), updated);
    vi.spyOn(PluginFetcherAdapter.prototype, "fetch").mockResolvedValue(pluginRoot);
    vi.spyOn(EnsureBuiltMarketplaceUseCase.prototype, "execute").mockResolvedValue({
      builtDir,
      version: "5.13.0",
      rebuilt: true,
    });
    return { rel, updated };
  }

  it("refuses a project-scoped record for a tool whose installation is user-scoped", async () => {
    const deps = await seed("cursor");
    const registry = join(root, ".aidd/marketplaces.json");
    const before = await readFile(registry, "utf8");
    await expect(
      deps.upgradeFrameworkUseCase.execute({
        projectRoot: root,
        release: "v5.13.0",
        allowShared: false,
        confirm,
      })
    ).rejects.toThrow(/scope differs/);
    expect(await readFile(registry, "utf8")).toBe(before);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("refuses an edited tracked file before confirmation or changing the source", async () => {
    const rel = ".opencode/skills/aidd-context/SKILL.md";
    const file = join(root, rel);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, "person's edit");
    const deps = await seed("opencode", { files: { [rel]: hash("original") } });
    const registry = join(root, ".aidd/marketplaces.json");
    const before = await readFile(registry, "utf8");
    await expect(
      deps.upgradeFrameworkUseCase.execute({
        projectRoot: root,
        release: "v5.13.0",
        allowShared: false,
        confirm,
      })
    ).rejects.toThrow(rel);
    expect(await readFile(file, "utf8")).toBe("person's edit");
    expect(await readFile(registry, "utf8")).toBe(before);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("refuses an older plugin version from the actual target manifest before changing the source", async () => {
    const deps = await seed("opencode");
    const manifest = await deps.manifestRepo.load();
    if (!manifest) throw new Error("missing manifest");
    const plugin = manifest.getPlugins("opencode")[0];
    const data = plugin.toJSON();
    data.version = "3.0.0";
    manifest.removePlugin("opencode", plugin.name);
    manifest.addPlugin("opencode", InstalledPlugin.fromJSON(data));
    await deps.manifestRepo.save(manifest);
    const registry = join(root, ".aidd/marketplaces.json");
    const before = await readFile(registry, "utf8");
    await expect(
      deps.upgradeFrameworkUseCase.execute({
        projectRoot: root,
        release: "v5.13.0",
        allowShared: false,
        confirm,
      })
    ).rejects.toThrow(/downgrade.*3\.0\.0.*2\.10\.0/i);
    expect(await readFile(registry, "utf8")).toBe(before);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("refuses a target manifest whose plugin name does not match the installed plugin", async () => {
    await writeFile(
      join(root, "plugins/aidd-context/.claude-plugin/plugin.json"),
      JSON.stringify({ name: "another-plugin", version: "2.10.0" })
    );
    const deps = await seed("opencode");
    const registry = join(root, ".aidd/marketplaces.json");
    const before = await readFile(registry, "utf8");
    await expect(
      deps.upgradeFrameworkUseCase.execute({
        projectRoot: root,
        release: "v5.13.0",
        allowShared: false,
        confirm,
      })
    ).rejects.toThrow(/Cannot verify the target plugin 'aidd-context'/);
    expect(await readFile(registry, "utf8")).toBe(before);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("refuses to reinstall a plugin removed from the manifest while awaiting confirmation", async () => {
    await fixtureDistribution();
    const deps = await seed("opencode");
    await expect(
      deps.upgradeFrameworkUseCase.execute({
        projectRoot: root,
        release: "v5.13.0",
        allowShared: false,
        confirm: async () => {
          const manifest = await deps.manifestRepo.load();
          if (!manifest) throw new Error("missing manifest");
          manifest.removePlugin("opencode", "aidd-context");
          await deps.manifestRepo.save(manifest);
          return true;
        },
      })
    ).rejects.toThrow(/Plugin aidd-context disappeared before installation/);
    expect((await deps.manifestRepo.load())?.getPlugins("opencode")).toHaveLength(0);
  });

  it("refuses an edited shared OpenCode MCP contribution before changing the source", async () => {
    const edited = JSON.stringify({ mcp: { mine: { type: "remote" } } });
    const file = join(root, "opencode.json");
    await writeFile(file, edited);
    const deps = await seed("opencode", {
      mcpEntries: { mine: hash(JSON.stringify({ type: "local" })) },
    });
    const registry = join(root, ".aidd/marketplaces.json");
    const before = await readFile(registry, "utf8");
    await expect(
      deps.upgradeFrameworkUseCase.execute({
        projectRoot: root,
        release: "v5.13.0",
        allowShared: false,
        confirm,
      })
    ).rejects.toThrow(/MCP.*edited/);
    expect(await readFile(file, "utf8")).toBe(edited);
    expect(await readFile(registry, "utf8")).toBe(before);
    expect(confirm).not.toHaveBeenCalled();
  });

  it.each(["tool file", "merge file"] as const)(
    "refuses a target already claimed as another tool's %s",
    async (kind) => {
      const { rel } = await fixtureDistribution();
      const file = join(root, rel);
      const existing = "other installation's content";
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, existing);
      const deps = await seed("opencode");
      const manifest = await deps.manifestRepo.load();
      if (!manifest) throw new Error("missing manifest");
      const tracked = new InstallationFile({
        relativePath: rel,
        content: existing,
        hash: new FileHash(hash(existing)),
      });
      manifest.addTool(
        "kilo",
        "5.6.0",
        kind === "tool file" ? [tracked] : [],
        kind === "merge file" ? [{ relativePath: rel, sectionKey: null, entries: {} }] : []
      );
      await deps.manifestRepo.save(manifest);
      const registry = join(root, ".aidd/marketplaces.json");
      const before = await readFile(registry, "utf8");
      await expect(
        deps.upgradeFrameworkUseCase.execute({
          projectRoot: root,
          release: "v5.13.0",
          allowShared: false,
          confirm,
        })
      ).rejects.toThrow(/claimed by another installation/i);
      expect(confirm).not.toHaveBeenCalled();
      expect(await readFile(file, "utf8")).toBe(existing);
      expect(await readFile(registry, "utf8")).toBe(before);
    }
  );

  it("refuses two incoming plugins that resolve to the same destination", async () => {
    await fixtureDistribution();
    const otherName = "aidd-context-extra";
    const otherManifest = join(root, "plugins", otherName, ".claude-plugin", "plugin.json");
    await mkdir(dirname(otherManifest), { recursive: true });
    await writeFile(otherManifest, JSON.stringify({ name: otherName, version: "2.10.0" }));
    const overlap = join(root, "built/.opencode/agents/aidd-context-extra-shared.md");
    await mkdir(dirname(overlap), { recursive: true });
    await writeFile(overlap, "agent for the more specific plugin");
    vi.mocked(ResolveMarketplaceUseCase.prototype.execute).mockImplementation(
      async ({ marketplace }) => ({
        marketplace,
        localPath: root,
        catalog: {
          version: "5.13.0",
          plugins: ["aidd-context", otherName].map((name) => ({
            name,
            source: { kind: "local" as const, path: `plugins/${name}` },
            recommended: false,
            strict: true,
          })),
        },
      })
    );
    const deps = await seed("opencode");
    const manifest = await deps.manifestRepo.load();
    if (!manifest) throw new Error("missing manifest");
    manifest.addPlugin(
      "opencode",
      InstalledPlugin.fromMetadata(
        otherName,
        "2.9.0",
        {
          kind: "git-subdir",
          url: "https://github.com/ai-driven-dev/framework.git",
          path: `plugins/${otherName}`,
          ref: "v5.12.0",
        },
        true,
        "project",
        "aidd-framework"
      )
    );
    await deps.manifestRepo.save(manifest);
    const registry = join(root, ".aidd/marketplaces.json");
    const before = await readFile(registry, "utf8");
    await expect(
      deps.upgradeFrameworkUseCase.execute({
        projectRoot: root,
        release: "v5.13.0",
        allowShared: false,
        confirm,
      })
    ).rejects.toThrow(/claimed by another plugin/i);
    expect(confirm).not.toHaveBeenCalled();
    expect(await readFile(registry, "utf8")).toBe(before);
    expect(existsSync(join(root, ".opencode/agents/aidd-context-extra-shared.md"))).toBe(false);
  });

  it("preserves a newly created target file if it appears after confirmation", async () => {
    const { rel } = await fixtureDistribution();
    const file = join(root, rel);
    const deps = await seed("opencode");
    await expect(
      deps.upgradeFrameworkUseCase.execute({
        projectRoot: root,
        release: "v5.13.0",
        allowShared: false,
        confirm: async () => {
          await mkdir(dirname(file), { recursive: true });
          await writeFile(file, "created while approving");
          return true;
        },
      })
    ).rejects.toThrow(/untracked/i);
    expect(await readFile(file, "utf8")).toBe("created while approving");
    expect((await deps.manifestRepo.load())?.getPlugins("opencode")[0].source).toMatchObject({
      ref: "v5.12.0",
    });
  });

  it("removes its preview build and leaves the installation unchanged when cancelled", async () => {
    await fixtureDistribution();
    const deps = await seed("opencode");
    const registry = join(root, ".aidd/marketplaces.json");
    const manifest = join(root, ".aidd/manifest.json");
    const beforeRegistry = await readFile(registry, "utf8");
    const beforeManifest = await readFile(manifest, "utf8");
    const result = await deps.upgradeFrameworkUseCase.execute({
      projectRoot: root,
      release: "v5.13.0",
      allowShared: false,
      confirm: async () => false,
    });
    expect(result.cancelled).toBe(true);
    expect(await readFile(registry, "utf8")).toBe(beforeRegistry);
    expect(await readFile(manifest, "utf8")).toBe(beforeManifest);
    const builds = vi.mocked(EnsureBuiltMarketplaceUseCase.prototype.execute).mock.calls;
    expect(builds).toHaveLength(1);
    const preview = builds[0]?.[0];
    if (!preview) throw new Error("missing preview build");
    expect(preview.marketplace.source).toMatchObject({ ref: "v5.13.0" });
    expect(preview.marketplace.scope).toBe("project");
    expect(existsSync(preview.projectRoot)).toBe(false);
  });

  it("does not report an update when an installer fails to record the requested release", async () => {
    await fixtureDistribution();
    const deps = await seed("opencode");
    const [marketplace] = await new MarketplaceRegistryAdapter().list(root);
    if (!marketplace) throw new Error("missing marketplace");
    vi.spyOn(PluginInstallFromMarketplaceUseCase.prototype, "execute").mockResolvedValue({
      marketplace,
      entry: {
        name: "aidd-context",
        source: { kind: "local", path: "plugins/aidd-context" },
        recommended: false,
        strict: true,
      },
    });
    await expect(
      deps.upgradeFrameworkUseCase.execute({
        projectRoot: root,
        release: "v5.13.0",
        allowShared: false,
        confirm,
      })
    ).rejects.toThrow(/Unable to verify the installed source/i);
    expect((await deps.manifestRepo.load())?.getPlugins("opencode")[0].source).toMatchObject({
      ref: "v5.12.0",
    });
  });

  it("preserves obsolete files if the manifest disappears during installation", async () => {
    await fixtureDistribution();
    const oldRel = ".opencode/skills/aidd-context/01-demo/obsolete.md";
    const oldPath = join(root, oldRel);
    await mkdir(dirname(oldPath), { recursive: true });
    await writeFile(oldPath, "still-owned content");
    const deps = await seed("opencode", { files: { [oldRel]: hash("still-owned content") } });
    const [marketplace] = await new MarketplaceRegistryAdapter().list(root);
    if (!marketplace) throw new Error("missing marketplace");
    vi.spyOn(PluginInstallFromMarketplaceUseCase.prototype, "execute").mockImplementation(
      async () => {
        await deps.manifestRepo.delete();
        return {
          marketplace,
          entry: {
            name: "aidd-context",
            source: { kind: "local", path: "plugins/aidd-context" },
            recommended: false,
            strict: true,
          },
        };
      }
    );
    await expect(
      deps.upgradeFrameworkUseCase.execute({
        projectRoot: root,
        release: "v5.13.0",
        allowShared: false,
        confirm,
      })
    ).rejects.toThrow(/Unable to verify the installed source/i);
    expect(await readFile(oldPath, "utf8")).toBe("still-owned content");
  });

  it.each([
    {
      field: "version",
      version: "2.9.0",
      source: {
        kind: "git-subdir",
        url: "https://github.com/ai-driven-dev/framework.git",
        path: "plugins/aidd-context",
        ref: "v5.13.0",
      },
    },
    { field: "source kind", version: "2.10.0", source: { kind: "local", path: "/other" } },
    {
      field: "repository",
      version: "2.10.0",
      source: {
        kind: "git-subdir",
        url: "https://github.com/example/other.git",
        path: "plugins/aidd-context",
        ref: "v5.13.0",
      },
    },
    {
      field: "plugin path",
      version: "2.10.0",
      source: {
        kind: "git-subdir",
        url: "https://github.com/ai-driven-dev/framework.git",
        path: "plugins/other",
        ref: "v5.13.0",
      },
    },
    {
      field: "release ref",
      version: "2.10.0",
      source: {
        kind: "git-subdir",
        url: "https://github.com/ai-driven-dev/framework.git",
        path: "plugins/aidd-context",
        ref: "v5.12.0",
      },
    },
  ])(
    "refuses to report success if the installed $field is different",
    async ({ version, source }) => {
      await fixtureDistribution();
      const oldRel = ".opencode/skills/aidd-context/01-demo/obsolete.md";
      const oldPath = join(root, oldRel);
      await mkdir(dirname(oldPath), { recursive: true });
      await writeFile(oldPath, "still-owned content");
      const deps = await seed("opencode", { files: { [oldRel]: hash("still-owned content") } });
      const [marketplace] = await new MarketplaceRegistryAdapter().list(root);
      if (!marketplace) throw new Error("missing marketplace");
      vi.spyOn(PluginInstallFromMarketplaceUseCase.prototype, "execute").mockImplementation(
        async () => {
          const manifest = await deps.manifestRepo.load();
          if (!manifest) throw new Error("missing manifest");
          const [old] = manifest.getPlugins("opencode");
          if (!old) throw new Error("missing plugin");
          manifest.updatePlugin(
            "opencode",
            InstalledPlugin.fromJSON({ ...old.toJSON(), version, source, files: {} })
          );
          await deps.manifestRepo.save(manifest);
          return {
            marketplace,
            entry: {
              name: "aidd-context",
              source: { kind: "local", path: "plugins/aidd-context" },
              recommended: false,
              strict: true,
            },
          };
        }
      );
      await expect(
        deps.upgradeFrameworkUseCase.execute({
          projectRoot: root,
          release: "v5.13.0",
          allowShared: false,
          confirm,
        })
      ).rejects.toThrow(/Unable to verify the installed source/i);
      expect(await readFile(oldPath, "utf8")).toBe("still-owned content");
    }
  );

  it("updates only the recorded tool and its existing tracked file", async () => {
    const { rel, updated } = await fixtureDistribution();
    const old = "---\nname: 01-demo\ndescription: old\n---\nold\n";
    const file = join(root, rel);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, old);
    const deps = await seed("opencode", { files: { [rel]: hash(old) } });
    const result = await deps.upgradeFrameworkUseCase.execute({
      projectRoot: root,
      release: "v5.13.0",
      allowShared: false,
      confirm,
    });
    expect(result.updated).toEqual(["opencode:aidd-context"]);
    expect(await readFile(file, "utf8")).toBe(updated);
    const manifest = await deps.manifestRepo.load();
    expect(manifest?.getPlugins("opencode")[0].source).toMatchObject({ ref: "v5.13.0" });
    expect(manifest?.getPlugins("opencode")[0].version).toBe("2.10.0");
    expect(manifest?.getPlugins("kilo")).toHaveLength(0);
  });

  it("preserves an untracked file if the target release introduces the same path", async () => {
    const { rel } = await fixtureDistribution();
    const file = join(root, rel);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, "person's existing file");
    const deps = await seed("opencode");
    const registry = join(root, ".aidd/marketplaces.json");
    const before = await readFile(registry, "utf8");
    await expect(
      deps.upgradeFrameworkUseCase.execute({
        projectRoot: root,
        release: "v5.13.0",
        allowShared: false,
        confirm,
      })
    ).rejects.toThrow(/untracked/);
    expect(await readFile(file, "utf8")).toBe("person's existing file");
    expect(await readFile(registry, "utf8")).toBe(before);
    expect(confirm).not.toHaveBeenCalled();
    expect((await deps.manifestRepo.load())?.getPlugins("opencode")[0].source).toMatchObject({
      ref: "v5.12.0",
    });
  });

  it("removes files owned by the old release that do not exist in the target", async () => {
    const { rel, updated } = await fixtureDistribution();
    const oldRel = ".opencode/skills/aidd-context/01-demo/obsolete.md";
    const oldPath = join(root, oldRel);
    const unrelated = join(root, ".opencode/skills/aidd-context/01-demo/user.md");
    await mkdir(dirname(oldPath), { recursive: true });
    await writeFile(oldPath, "old release");
    await writeFile(unrelated, "user file");
    const deps = await seed("opencode", { files: { [oldRel]: hash("old release") } });
    await deps.upgradeFrameworkUseCase.execute({
      projectRoot: root,
      release: "v5.13.0",
      allowShared: false,
      confirm,
    });
    await expect(readFile(oldPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(unrelated, "utf8")).toBe("user file");
    expect(await readFile(join(root, rel), "utf8")).toBe(updated);
    expect((await deps.manifestRepo.load())?.getPlugins("opencode")[0].files.has(oldRel)).toBe(
      false
    );
  });

  it("preserves an obsolete file edited after the user approves", async () => {
    await fixtureDistribution();
    const oldRel = ".opencode/skills/aidd-context/01-demo/obsolete.md";
    const oldPath = join(root, oldRel);
    await mkdir(dirname(oldPath), { recursive: true });
    await writeFile(oldPath, "original content");
    const deps = await seed("opencode", { files: { [oldRel]: hash("original content") } });
    await expect(
      deps.upgradeFrameworkUseCase.execute({
        projectRoot: root,
        release: "v5.13.0",
        allowShared: false,
        confirm: async () => {
          await writeFile(oldPath, "user edit during approval");
          return true;
        },
      })
    ).rejects.toThrow(/modified or missing/i);
    expect(await readFile(oldPath, "utf8")).toBe("user edit during approval");
  });

  it("reports failure if an obsolete file could not actually be removed", async () => {
    await fixtureDistribution();
    const oldRel = ".opencode/skills/aidd-context/01-demo/obsolete.md";
    const oldPath = join(root, oldRel);
    await mkdir(dirname(oldPath), { recursive: true });
    await writeFile(oldPath, "original content");
    const deps = await seed("opencode", { files: { [oldRel]: hash("original content") } });
    const remove = deps.fs.deleteFile.bind(deps.fs);
    vi.spyOn(deps.fs, "deleteFile").mockImplementation(async (path) => {
      if (path !== oldPath) await remove(path);
    });
    await expect(
      deps.upgradeFrameworkUseCase.execute({
        projectRoot: root,
        release: "v5.13.0",
        allowShared: false,
        confirm,
      })
    ).rejects.toThrow(/Cannot remove obsolete file/i);
    expect(await readFile(oldPath, "utf8")).toBe("original content");
  });

  it.each(["tool file", "merge file"] as const)(
    "preserves an obsolete file still claimed as another tool's %s",
    async (kind) => {
      await fixtureDistribution();
      const oldRel = ".opencode/skills/aidd-context/01-demo/obsolete.md";
      const oldPath = join(root, oldRel);
      const content = "shared file";
      await mkdir(dirname(oldPath), { recursive: true });
      await writeFile(oldPath, content);
      const deps = await seed("opencode", { files: { [oldRel]: hash(content) } });
      const manifest = await deps.manifestRepo.load();
      if (!manifest) throw new Error("missing manifest");
      const file = new InstallationFile({
        relativePath: oldRel,
        content,
        hash: new FileHash(hash(content)),
      });
      manifest.addTool(
        "kilo",
        "5.6.0",
        kind === "tool file" ? [file] : [],
        kind === "merge file" ? [{ relativePath: oldRel, sectionKey: null, entries: {} }] : []
      );
      await deps.manifestRepo.save(manifest);
      await deps.upgradeFrameworkUseCase.execute({
        projectRoot: root,
        release: "v5.13.0",
        allowShared: false,
        confirm,
      });
      expect(await readFile(oldPath, "utf8")).toBe(content);
      const result = await deps.manifestRepo.load();
      expect(result?.getPlugins("opencode")[0].files.has(oldRel)).toBe(false);
      expect(result?.isFileTracked(oldRel)).toBe(true);
    }
  );

  it("refuses a file also owned by another plugin in the same tool", async () => {
    const { rel } = await fixtureDistribution();
    const file = join(root, rel);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, "shared file");
    const deps = await seed("opencode", { files: { [rel]: hash("shared file") } });
    const manifest = await deps.manifestRepo.load();
    if (!manifest) throw new Error("missing manifest");
    const other = InstalledPlugin.fromMetadata(
      "other",
      "1.0.0",
      { kind: "local", path: "/other" },
      true,
      "project"
    );
    manifest.addPlugin(
      "opencode",
      InstalledPlugin.fromJSON({ ...other.toJSON(), files: { [rel]: hash("shared file") } })
    );
    await deps.manifestRepo.save(manifest);
    const registry = join(root, ".aidd/marketplaces.json");
    const before = await readFile(registry, "utf8");
    await expect(
      deps.upgradeFrameworkUseCase.execute({
        projectRoot: root,
        release: "v5.13.0",
        allowShared: false,
        confirm,
      })
    ).rejects.toThrow(/claimed by another/i);
    expect(await readFile(file, "utf8")).toBe("shared file");
    expect(await readFile(registry, "utf8")).toBe(before);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("refuses to overwrite a path also claimed by another plugin", async () => {
    const { rel } = await fixtureDistribution();
    const file = join(root, rel);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, "shared file");
    const deps = await seed("opencode", { files: { [rel]: hash("shared file") } });
    const manifest = await deps.manifestRepo.load();
    if (!manifest) throw new Error("missing manifest");
    manifest.addTool("kilo", "5.6.0", []);
    const other = InstalledPlugin.fromMetadata(
      "other",
      "1.0.0",
      { kind: "local", path: "/other" },
      true,
      "project"
    );
    manifest.addPlugin(
      "kilo",
      InstalledPlugin.fromJSON({ ...other.toJSON(), files: { [rel]: hash("shared file") } })
    );
    await deps.manifestRepo.save(manifest);
    const before = await readFile(join(root, ".aidd/marketplaces.json"), "utf8");
    await expect(
      deps.upgradeFrameworkUseCase.execute({
        projectRoot: root,
        release: "v5.13.0",
        allowShared: false,
        confirm,
      })
    ).rejects.toThrow(/claimed by another/i);
    expect(await readFile(file, "utf8")).toBe("shared file");
    expect(await readFile(join(root, ".aidd/marketplaces.json"), "utf8")).toBe(before);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("preserves an obsolete path still owned by another plugin", async () => {
    await fixtureDistribution();
    const oldRel = ".opencode/skills/aidd-context/01-demo/obsolete.md";
    const oldPath = join(root, oldRel);
    await mkdir(dirname(oldPath), { recursive: true });
    await writeFile(oldPath, "shared file");
    const deps = await seed("opencode", { files: { [oldRel]: hash("shared file") } });
    const manifest = await deps.manifestRepo.load();
    if (!manifest) throw new Error("missing manifest");
    manifest.addTool("kilo", "5.6.0", []);
    const other = InstalledPlugin.fromMetadata(
      "other",
      "1.0.0",
      { kind: "local", path: "/other" },
      true,
      "project"
    );
    manifest.addPlugin(
      "kilo",
      InstalledPlugin.fromJSON({ ...other.toJSON(), files: { [oldRel]: hash("shared file") } })
    );
    await deps.manifestRepo.save(manifest);
    await deps.upgradeFrameworkUseCase.execute({
      projectRoot: root,
      release: "v5.13.0",
      allowShared: false,
      confirm,
    });
    expect(await readFile(oldPath, "utf8")).toBe("shared file");
    expect((await deps.manifestRepo.load())?.getPlugins("kilo")[0].files.has(oldRel)).toBe(true);
  });

  it.skipIf(process.platform === "win32")(
    "refuses a broken symlink at an incoming target path before moving the marketplace",
    async () => {
      const { rel } = await fixtureDistribution();
      const file = join(root, rel);
      await mkdir(dirname(file), { recursive: true });
      await symlink(join(root, "missing"), file);
      const deps = await seed("opencode");
      const registry = join(root, ".aidd/marketplaces.json");
      const before = await readFile(registry, "utf8");
      await expect(
        deps.upgradeFrameworkUseCase.execute({
          projectRoot: root,
          release: "v5.13.0",
          allowShared: false,
          confirm,
        })
      ).rejects.toThrow(/symlink|untracked/i);
      expect(await readFile(registry, "utf8")).toBe(before);
      expect(confirm).not.toHaveBeenCalled();
    }
  );

  it.skipIf(process.platform === "win32")(
    "refuses a tracked file replaced by a matching symlink before moving the marketplace",
    async () => {
      const { rel } = await fixtureDistribution();
      const file = join(root, rel);
      const target = join(root, "user-file.md");
      await mkdir(dirname(file), { recursive: true });
      await writeFile(target, "old release");
      await symlink(target, file);
      const deps = await seed("opencode", { files: { [rel]: hash("old release") } });
      const registry = join(root, ".aidd/marketplaces.json");
      const before = await readFile(registry, "utf8");
      await expect(
        deps.upgradeFrameworkUseCase.execute({
          projectRoot: root,
          release: "v5.13.0",
          allowShared: false,
          confirm,
        })
      ).rejects.toThrow(/symlink/i);
      expect(await readFile(registry, "utf8")).toBe(before);
      expect(await readFile(target, "utf8")).toBe("old release");
      expect(confirm).not.toHaveBeenCalled();
    }
  );

  it.skipIf(process.platform === "win32")(
    "refuses an obsolete tracked file replaced by a matching symlink before moving the marketplace",
    async () => {
      await fixtureDistribution();
      const rel = ".opencode/skills/aidd-context/01-demo/obsolete.md";
      const file = join(root, rel);
      const target = join(root, "user-file.md");
      await mkdir(dirname(file), { recursive: true });
      await writeFile(target, "old release");
      await symlink(target, file);
      const deps = await seed("opencode", { files: { [rel]: hash("old release") } });
      const registry = join(root, ".aidd/marketplaces.json");
      const before = await readFile(registry, "utf8");
      await expect(
        deps.upgradeFrameworkUseCase.execute({
          projectRoot: root,
          release: "v5.13.0",
          allowShared: false,
          confirm,
        })
      ).rejects.toThrow(/symlink/i);
      expect(await readFile(registry, "utf8")).toBe(before);
      expect(await readFile(target, "utf8")).toBe("old release");
      expect(confirm).not.toHaveBeenCalled();
    }
  );

  it.skipIf(process.platform === "win32")(
    "refuses a broken symlink in an incoming target's parent before moving the marketplace",
    async () => {
      await fixtureDistribution();
      const dir = join(root, ".opencode");
      await mkdir(dir, { recursive: true });
      await symlink(join(root, "missing"), join(dir, "skills"));
      const deps = await seed("opencode");
      const registry = join(root, ".aidd/marketplaces.json");
      const before = await readFile(registry, "utf8");
      await expect(
        deps.upgradeFrameworkUseCase.execute({
          projectRoot: root,
          release: "v5.13.0",
          allowShared: false,
          confirm,
        })
      ).rejects.toThrow(/symlink/i);
      expect(await readFile(registry, "utf8")).toBe(before);
      expect(confirm).not.toHaveBeenCalled();
    }
  );
});
