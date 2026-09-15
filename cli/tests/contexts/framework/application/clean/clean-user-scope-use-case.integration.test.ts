import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import {
  FRAMEWORK_MARKETPLACE_NAME,
  Marketplace,
} from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { CleanUserScopeUseCase } from "../../../../../src/contexts/framework/application/clean/clean-user-scope-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { UserSourceReferencesAdapter } from "../../../../../src/contexts/framework/infrastructure/user-source-references-adapter.js";
import type { NativeMarketplaceSourceReader } from "../../../../../src/contexts/tools/domain/ports/native-marketplace-source-reader.js";
import type { NativePluginActivator } from "../../../../../src/contexts/tools/domain/ports/native-plugin-activator.js";
import type { MarketplaceScope } from "../../../../../src/kernel/scope.js";
import type { ToolId } from "../../../../../src/kernel/tool.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { FakeHostMarketplaceRegistryReader } from "../../../../helpers/ports/fake-host-marketplace-registry-reader.js";
import { FakeHostPluginRegistryReader } from "../../../../helpers/ports/fake-host-plugin-registry-reader.js";
import { FakeNativePluginActivator } from "../../../../helpers/ports/fake-native-plugin-activator.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";
import { RecordingPrompter } from "../../../../helpers/ports/recording-prompter.js";

const USER_CONFIG_DIR = "/fake-home/.config/aidd";
const HOME = "/fake-home";
const CLAUDE_CACHE = join(HOME, ".claude", "plugins", "cache");
const CODEX_CACHE = join(HOME, ".codex", "plugins", "cache");
const WHITELIST_PURGE_MESSAGES = [
  `user scope: cache/built purged: ${join(USER_CONFIG_DIR, "cache", "built")}`,
  `user scope: cache/update-check.json purged: ${join(USER_CONFIG_DIR, "cache", "update-check.json")}`,
  `user scope: cache purged: ${join(USER_CONFIG_DIR, "cache")}`,
  `user scope: update-check.json purged: ${join(USER_CONFIG_DIR, "update-check.json")}`,
  `user scope: references.json purged: ${join(USER_CONFIG_DIR, "references.json")}`,
];

/** Records every delete in order, so an ordering constraint can be proved without reading
 * the use case's own private state. A shared array correlates with another recorder. */
class RecordingFileAdapter extends InMemoryFileAdapter {
  readonly order: string[];

  constructor(order: string[] = []) {
    super();
    this.order = order;
  }

  override async deleteDirectory(path: string): Promise<void> {
    this.order.push(`deleteDirectory:${path}`);
    return super.deleteDirectory(path);
  }

  override async deleteFile(path: string): Promise<void> {
    this.order.push(`deleteFile:${path}`);
    return super.deleteFile(path);
  }
}

/** Pushes into the same shared `order` log the file adapter above writes to, so "the host was
 * asked to forget this marketplace" and "its cache was deleted" sit on one timeline. */
class RecordingActivator implements NativePluginActivator {
  readonly order: string[];
  readonly removedMarketplaces: string[] = [];
  readonly removedMarketplaceScopes: MarketplaceScope[] = [];
  readonly uninstalledPlugins: string[] = [];
  readonly uninstalledPluginScopes: MarketplaceScope[] = [];

  constructor(order: string[]) {
    this.order = order;
  }

  isAvailable(): boolean {
    return true;
  }
  addMarketplace(): void {}
  enablesPlugins(): boolean {
    return true;
  }
  removeMarketplace(name: string, scope: MarketplaceScope): void {
    this.order.push(`removeMarketplace:${name}`);
    this.removedMarketplaces.push(name);
    this.removedMarketplaceScopes.push(scope);
  }
  registrationState(): "live" | "dead" | "unknown" {
    return "unknown";
  }
  upgradeMarketplaces(): void {}
  enablePlugin(): void {}
  uninstallPlugin(pluginRef: string, scope: MarketplaceScope = "project"): void {
    this.order.push(`uninstallPlugin:${pluginRef}`);
    this.uninstalledPlugins.push(pluginRef);
    this.uninstalledPluginScopes.push(scope);
  }
}

class StrictListingFileAdapter extends InMemoryFileAdapter {
  constructor(private readonly deniedDir?: string) {
    super();
  }

  override async listDirectory(dirPath: string): Promise<string[]> {
    if (dirPath === this.deniedDir) {
      throw Object.assign(new Error("permission denied"), { code: "EACCES" });
    }
    if (!(await this.fileExists(dirPath))) {
      throw Object.assign(new Error(`ENOENT: no such directory, ${dirPath}`), { code: "ENOENT" });
    }
    return super.listDirectory(dirPath);
  }
}

function manifestWithClaude(): Manifest {
  const manifest = Manifest.create();
  manifest.addTool("claude", "1.0.0", []);
  manifest.setNativeRegistrations("claude", {
    binary: "claude",
    marketplaces: [
      {
        alias: "aidd-framework",
        hostName: "aidd-framework",
        provenance: { kind: "registry", source: "/built/claude" },
      },
    ],
    pluginRefs: ["aidd-context@aidd-framework"],
    pluginClaims: [{ ref: "aidd-context@aidd-framework", dependents: [] }],
  });
  return manifest;
}

function provenClaudeSources(
  source = "/built/claude"
): ReadonlyMap<"claude", NativeMarketplaceSourceReader> {
  return new Map([
    [
      "claude",
      {
        read: async () => ({
          location: "known_marketplaces.json",
          entries: new Map([["aidd-framework", { kind: "registry" as const, source }]]),
        }),
      },
    ],
  ]);
}

function provenHostPlugins(
  manifest: Manifest
): ReadonlyMap<"claude" | "codex", FakeHostPluginRegistryReader> {
  const readers = new Map<"claude" | "codex", FakeHostPluginRegistryReader>();
  for (const toolId of ["claude", "codex"] as const) {
    const registrations = manifest.getNativeRegistrations(toolId);
    if (registrations === undefined) continue;
    readers.set(
      toolId,
      new FakeHostPluginRegistryReader({
        location: `${toolId} installed plugins`,
        refs: new Map(
          (registrations.pluginClaims ?? []).map(({ ref }) => [ref, { enabled: true }])
        ),
      })
    );
  }
  return readers;
}

/** Seeds the cache path claude's own profile declares with a marker file: an empty or absent
 * directory is silently skipped rather than purged. */
function seedClaudeCache(fs: InMemoryFileAdapter, hostName = "aidd-framework"): string {
  const cachePath = join(HOME, ".claude", "plugins", "cache", hostName);
  fs.setFile(join(cachePath, "marker.json"), "{}");
  return cachePath;
}

describe("clean --scope user", () => {
  it("refuses an owned catalogue with a foreign enabled plugin ref before any global clean effect", async () => {
    const machine = manifestWithClaude();
    const repo = new InMemoryManifestRepository(machine);
    const fs = new RecordingFileAdapter();
    const foreignCache = join(CLAUDE_CACHE, "aidd-framework", "foreign-payload", "bytes");
    fs.setFile(foreignCache, "foreign bytes");
    const activator = new RecordingActivator([]);
    const hostPlugins = new FakeHostPluginRegistryReader({
      location: "installed_plugins.json",
      refs: new Map([
        ["aidd-context@aidd-framework", { enabled: true }],
        ["foreign@aidd-framework", { enabled: true }],
      ]),
    });
    const useCase = new CleanUserScopeUseCase(
      fs,
      repo,
      new CapturingLogger(),
      new InMemoryMarketplaceRegistry(),
      () => USER_CONFIG_DIR,
      new Map([["claude", activator]]),
      new Map(),
      () => HOME,
      undefined,
      undefined,
      provenClaudeSources(),
      new Map([["claude", hostPlugins]])
    );
    await expect(useCase.execute({ projectRoot: "/A", force: true })).rejects.toThrow(
      /foreign.*ref.*foreign@aidd-framework/
    );
    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(await fs.readFile(foreignCache)).toBe("foreign bytes");
    expect(repo.getCurrent()?.getNativeRegistrations("claude")?.pluginClaims).toHaveLength(1);
  });
  it("preflights every native source before uninstalling any other catalogue", async () => {
    const machine = manifestWithClaude();
    machine.addTool("codex", "1.0.0", []);
    machine.setNativeRegistrations("codex", {
      binary: "codex",
      marketplaces: [
        {
          alias: "foreign-alias",
          hostName: "foreign-name",
          provenance: { kind: "effective-list", root: "/old", sourceType: "local", source: "/old" },
        },
      ],
      pluginRefs: ["plugin@foreign-name"],
      pluginClaims: [{ ref: "plugin@foreign-name", dependents: [] }],
    });
    const claude = new RecordingActivator([]);
    const codex = new RecordingActivator([]);
    const repo = new InMemoryManifestRepository(machine);
    const fs = new RecordingFileAdapter();
    const claudeSource = provenClaudeSources().get("claude");
    if (claudeSource === undefined) throw new Error("fixture missing Claude source reader");
    const sources = new Map<"claude" | "codex", NativeMarketplaceSourceReader>([
      ["claude", claudeSource],
      [
        "codex",
        {
          read: async () => ({
            location: "host",
            entries: new Map([
              [
                "foreign-name",
                {
                  kind: "effective-list",
                  root: "/foreign",
                  sourceType: "local",
                  source: "/foreign",
                },
              ],
            ]),
          }),
        },
      ],
    ]);
    const useCase = new CleanUserScopeUseCase(
      fs,
      repo,
      new CapturingLogger(),
      new InMemoryMarketplaceRegistry(),
      () => USER_CONFIG_DIR,
      new Map([
        ["claude", claude],
        ["codex", codex],
      ]),
      new Map(),
      () => HOME,
      undefined,
      undefined,
      sources,
      provenHostPlugins(machine)
    );
    await expect(useCase.execute({ projectRoot: "/A", force: true })).rejects.toThrow(
      /current host source differs.*reconcile manually/
    );
    expect(claude.uninstalledPlugins).toEqual([]);
    expect(claude.removedMarketplaces).toEqual([]);
    expect(codex.uninstalledPlugins).toEqual([]);
    expect(codex.removedMarketplaces).toEqual([]);
    expect(repo.getCurrent()?.getNativeRegistrations("claude")).toBeDefined();
  });
  it("refuses all native host mutations when a stale canonical source points at a foreign Codex catalogue", async () => {
    const machine = Manifest.create();
    machine.addTool("codex", "1.0.0", []);
    machine.setNativeRegistrations("codex", {
      binary: "codex",
      marketplaces: [
        {
          alias: "alias",
          hostName: "foreign-name",
          provenance: { kind: "effective-list", root: "/old", sourceType: "local", source: "/old" },
        },
      ],
      pluginRefs: ["plugin@foreign-name"],
      pluginClaims: [{ ref: "plugin@foreign-name", dependents: [] }],
    });
    const repo = new InMemoryManifestRepository(machine);
    const fs = new RecordingFileAdapter();
    const activator = new RecordingActivator([]);
    const source: NativeMarketplaceSourceReader = {
      read: async () => ({
        location: "host",
        entries: new Map([
          [
            "foreign-name",
            { kind: "effective-list", root: "/foreign", sourceType: "local", source: "/foreign" },
          ],
        ]),
      }),
    };
    const useCase = new CleanUserScopeUseCase(
      fs,
      repo,
      new CapturingLogger(),
      new InMemoryMarketplaceRegistry(),
      () => USER_CONFIG_DIR,
      new Map([["codex", activator]]),
      new Map(),
      () => HOME,
      undefined,
      undefined,
      new Map([["codex", source]])
    );
    await expect(useCase.execute({ projectRoot: "/A", force: true })).rejects.toThrow(
      /current host source differs.*reconcile manually/
    );
    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(repo.getCurrent()?.getNativeRegistrations("codex")?.marketplaces).toHaveLength(1);
  });
  it("refuses an active B native ref even with force, then succeeds only after B detaches", async () => {
    const machine = manifestWithClaude();
    const registrations = machine.getNativeRegistrations("claude");
    if (registrations === undefined) throw new Error("fixture missing native registration");
    machine.setNativeRegistrations("claude", {
      ...registrations,
      pluginClaims: [{ ref: "aidd-context@aidd-framework", dependents: ["/B"] }],
    });
    const repo = new InMemoryManifestRepository(machine);
    const fs = new RecordingFileAdapter();
    const activator = new RecordingActivator([]);
    const useCase = new CleanUserScopeUseCase(
      fs,
      repo,
      new CapturingLogger(),
      new InMemoryMarketplaceRegistry(),
      () => USER_CONFIG_DIR,
      new Map([["claude", activator]]),
      new Map([
        [
          "claude",
          new FakeHostMarketplaceRegistryReader({
            location: "known_marketplaces.json",
            entries: new Map(),
          }),
        ],
      ]),
      () => HOME,
      undefined,
      undefined,
      provenClaudeSources(),
      provenHostPlugins(machine)
    );
    await expect(useCase.execute({ projectRoot: "/A", force: true })).rejects.toThrow(
      /active projects.*\/B/
    );
    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(repo.getCurrent()?.getNativeRegistrations("claude")?.pluginClaims).toEqual([
      { ref: "aidd-context@aidd-framework", dependents: ["/B"] },
    ]);
    machine.setNativeRegistrations("claude", {
      ...registrations,
      pluginClaims: [{ ref: "aidd-context@aidd-framework", dependents: [] }],
    });
    await useCase.execute({ projectRoot: "/A", force: true });
    expect(activator.uninstalledPlugins).toEqual(["aidd-context@aidd-framework"]);
    expect(activator.removedMarketplaces).toEqual(["aidd-framework"]);
    expect(repo.getCurrent()).toBeNull();
  });

  it("refuses an active B Cursor user plugin but never treats project files as machine-owned", async () => {
    const userFile = join(HOME, ".cursor", "plugins", "local", "shared", "skills", "x.md");
    const projectFile = "/A/skills/local.md";
    const fs = new RecordingFileAdapter();
    fs.setFile(userFile, "shared bytes");
    fs.setFile(projectFile, "project bytes");
    const machine = Manifest.create();
    machine.addTool("cursor", "1.0.0", []);
    const shared = InstalledPlugin.fromMetadata(
      "shared",
      "1.0.0",
      { kind: "local", path: "/source" },
      false,
      "user"
    )
      .withFiles(
        new Map([["shared/skills/x.md", createHash("md5").update("shared bytes").digest("hex")]])
      )
      .withDependents(["/B"]);
    machine.addPlugin("cursor", shared);
    machine.addPlugin(
      "cursor",
      InstalledPlugin.fromMetadata(
        "local",
        "1.0.0",
        { kind: "local", path: "/source" },
        false,
        "project"
      )
        .withFiles(new Map([["skills/local.md", "hash"]]))
        .withDependents(["/project-foreign"])
    );
    const repo = new InMemoryManifestRepository(machine);
    const useCase = new CleanUserScopeUseCase(
      fs,
      repo,
      new CapturingLogger(),
      new InMemoryMarketplaceRegistry(),
      () => USER_CONFIG_DIR,
      new Map(),
      new Map(),
      () => HOME
    );

    expect(
      (await useCase.execute({ projectRoot: "/A", force: false })).preview.activePluginDependents
    ).toEqual(["/B"]);
    await expect(useCase.execute({ projectRoot: "/A", force: true })).rejects.toThrow(/\/B/);
    expect(fs.has(userFile)).toBe(true);
    expect(fs.has(projectFile)).toBe(true);
    expect(
      repo
        .getCurrent()
        ?.getPlugins("cursor")
        .find((plugin) => plugin.name === "shared")?.dependents
    ).toEqual(["/B"]);

    machine.updatePlugin("cursor", shared.withDependents([]));
    await useCase.execute({ projectRoot: "/A", force: true });
    expect(repo.getCurrent()).toBeNull();
    expect(fs.has(projectFile)).toBe(true);
  });

  it("retains canonical claims if the user catalogue registry refuses the final delete", async () => {
    class RefusingRegistry extends InMemoryMarketplaceRegistry {
      override async delete(_root: string, _name: string, _scope: MarketplaceScope): Promise<void> {
        throw new Error("registry delete failed");
      }
    }
    const repo = new InMemoryManifestRepository(Manifest.create());
    const useCase = new CleanUserScopeUseCase(
      new RecordingFileAdapter(),
      repo,
      new CapturingLogger(),
      new RefusingRegistry(),
      () => USER_CONFIG_DIR
    );
    await expect(useCase.execute({ projectRoot: "/A", force: true })).rejects.toThrow(
      /registry delete failed/
    );
    expect(repo.getCurrent()).not.toBeNull();
  });

  describe("no user manifest, machine state from a project-scope setup", () => {
    it("still purges the whitelist and touches no host, naming the referencing projects", async () => {
      const order: string[] = [];
      const fs = new RecordingFileAdapter(order);
      fs.setFile(
        join(USER_CONFIG_DIR, "cache", "built", "1.0.0", "aidd-framework", "claude", "x"),
        "1"
      );
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(
        "/wherever",
        Marketplace.create({
          name: FRAMEWORK_MARKETPLACE_NAME,
          source: { kind: "local", path: "/src/framework" },
          scope: "user",
          addedAt: "2026-01-01T00:00:00Z",
        })
      );
      const userSourceReferences = new UserSourceReferencesAdapter(fs, () => USER_CONFIG_DIR);
      await userSourceReferences.addReference("1.0.0", "/project-a");
      fs.setFile("/project-a/marker", "");
      const activator = new RecordingActivator(order);
      const logger = new CapturingLogger();
      const useCase = new CleanUserScopeUseCase(
        fs,
        new InMemoryManifestRepository(null),
        logger,
        registry,
        () => USER_CONFIG_DIR,
        new Map([["claude", activator]]),
        new Map(),
        () => HOME,
        userSourceReferences
      );

      await expect(useCase.execute({ projectRoot: "/wherever", force: true })).rejects.toThrow(
        /active projects.*\/project-a/
      );
      expect(fs.order).not.toContain(`deleteDirectory:${join(USER_CONFIG_DIR, "cache", "built")}`);
      // No manifest means no `nativeRegistrations` to drive a host's own CLI through —
      // the activator that would have recorded a real call never sees one.
      expect(activator.removedMarketplaces).toEqual([]);
      expect(activator.uninstalledPlugins).toEqual([]);
      const info = logger.infoMessages.find((m) => m.includes("No host registration"));
      expect(info).toBeDefined();
      expect(info).toContain("/project-a");
      // Both removal commands, in order: `aidd clean --scope user` also satisfies a bare
      // `.toContain("aidd clean")`, so the per-project half needs its own assertion.
      expect(info).toContain("`aidd clean`");
      expect(info).toContain("`aidd clean --scope user`");
      expect(info?.indexOf("`aidd clean`")).toBeLessThan(
        info?.indexOf("`aidd clean --scope user`") ?? -1
      );
    });
  });

  describe("order", () => {
    it("unregisters the marketplace through the host CLI before purging its cache", async () => {
      const order: string[] = [];
      const fs = new RecordingFileAdapter(order);
      seedClaudeCache(fs);
      const activator = new RecordingActivator(order);
      const manifestRepo = new InMemoryManifestRepository(manifestWithClaude());
      const useCase = new CleanUserScopeUseCase(
        fs,
        manifestRepo,
        new CapturingLogger(),
        new InMemoryMarketplaceRegistry(),
        () => USER_CONFIG_DIR,
        new Map([["claude", activator]]),
        new Map([
          [
            "claude",
            new FakeHostMarketplaceRegistryReader({
              location: "known_marketplaces.json",
              entries: new Map(),
            }),
          ],
        ]),
        () => HOME,
        undefined,
        undefined,
        provenClaudeSources(),
        provenHostPlugins(manifestWithClaude())
      );

      await useCase.execute({ projectRoot: "/wherever", force: true });

      const removeIndex = order.indexOf("removeMarketplace:aidd-framework");
      const purgeIndex = order.findIndex((entry) => entry.startsWith("deleteDirectory:"));
      expect(removeIndex).toBeGreaterThanOrEqual(0);
      expect(purgeIndex).toBeGreaterThanOrEqual(0);
      expect(removeIndex).toBeLessThan(purgeIndex);
    });
  });

  describe("whitelist", () => {
    it("deletes exactly cache/built, manifest.json, references.json and the aidd-framework marketplaces.json entry — nothing else", async () => {
      const fs = new RecordingFileAdapter();
      fs.setFile(
        join(USER_CONFIG_DIR, "cache", "built", "1.0.0", "aidd-framework", "claude", "x"),
        "1"
      );
      const manifestRepo = new InMemoryManifestRepository(Manifest.create());
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(
        "/wherever",
        Marketplace.create({
          name: FRAMEWORK_MARKETPLACE_NAME,
          source: { kind: "local", path: "/src/framework" },
          scope: "user",
          addedAt: "2026-01-01T00:00:00Z",
        })
      );
      await registry.save(
        "/wherever",
        Marketplace.create({
          name: "other-marketplace",
          source: { kind: "local", path: "/src/other" },
          scope: "user",
          addedAt: "2026-01-01T00:00:00Z",
        })
      );
      const userSourceReferences = new UserSourceReferencesAdapter(fs, () => USER_CONFIG_DIR);
      await userSourceReferences.addReference("1.0.0", "/project-a");
      await userSourceReferences.removeReference("/project-a");
      const useCase = new CleanUserScopeUseCase(
        fs,
        manifestRepo,
        new CapturingLogger(),
        registry,
        () => USER_CONFIG_DIR,
        new Map(),
        new Map(),
        () => HOME,
        userSourceReferences
      );

      await useCase.execute({ projectRoot: "/wherever", force: true });

      expect(fs.order).toContain(`deleteDirectory:${join(USER_CONFIG_DIR, "cache", "built")}`);
      expect(fs.order).toContain(`deleteFile:${join(USER_CONFIG_DIR, "references.json")}`);
      expect(manifestRepo.getCurrent()).toBeNull();
      const remaining = registry.getAll("/wherever").map((m) => m.name);
      expect(remaining).not.toContain(FRAMEWORK_MARKETPLACE_NAME);
      expect(remaining).toContain("other-marketplace");
    });

    it("deletes the update-check cache too, so nothing is left to keep the cache/ shell alive", async () => {
      const fs = new RecordingFileAdapter();
      fs.setFile(
        join(USER_CONFIG_DIR, "cache", "built", "1.0.0", "aidd-framework", "claude", "x"),
        "1"
      );
      // Written by any online command into the same `cache/` directory `cache/built/` sits
      // in — the occupant that used to survive a machine-scope clean and keep the shell alive.
      fs.setFile(join(USER_CONFIG_DIR, "cache", "update-check.json"), '{"latest":"9.9.9"}');
      // And where an older CLI wrote the same cache, before it moved under `cache/`.
      fs.setFile(join(USER_CONFIG_DIR, "update-check.json"), '{"latest":"8.0.0"}');
      const useCase = new CleanUserScopeUseCase(
        fs,
        new InMemoryManifestRepository(Manifest.create()),
        new CapturingLogger(),
        new InMemoryMarketplaceRegistry(),
        () => USER_CONFIG_DIR
      );

      await useCase.execute({ projectRoot: "/wherever", force: true });

      expect(fs.order).toContain(
        `deleteFile:${join(USER_CONFIG_DIR, "cache", "update-check.json")}`
      );
      expect(await fs.fileExists(join(USER_CONFIG_DIR, "cache", "update-check.json"))).toBe(false);
      expect(fs.order).toContain(`deleteFile:${join(USER_CONFIG_DIR, "update-check.json")}`);
      // Nothing else sat beside it, so the shell itself goes with it.
      expect(fs.order).toContain(`deleteDirectory:${join(USER_CONFIG_DIR, "cache")}`);
    });

    it("never deletes userConfigDir() itself, even when references.json resolves back to it through a symlink", async () => {
      const fs = new RecordingFileAdapter();
      fs.setFile(join(USER_CONFIG_DIR, "marker"), "1");
      // A corrupted or attacker-controlled state: the references file has become a
      // symlink pointing straight back at userConfigDir() itself.
      fs.setSymlink(join(USER_CONFIG_DIR, "references.json"), USER_CONFIG_DIR);
      const logger = new CapturingLogger();
      const useCase = new CleanUserScopeUseCase(
        fs,
        new InMemoryManifestRepository(Manifest.create()),
        logger,
        new InMemoryMarketplaceRegistry(),
        () => USER_CONFIG_DIR
      );

      await useCase.execute({ projectRoot: "/wherever", force: true });

      // references.json's own candidate resolves straight back to userConfigDir() itself,
      // which containment refuses regardless of equality.
      expect(fs.order).not.toContain(`deleteFile:${join(USER_CONFIG_DIR, "references.json")}`);
      expect(fs.order).not.toContain(`deleteFile:${USER_CONFIG_DIR}`);
      expect(fs.order.some((entry) => entry.endsWith(USER_CONFIG_DIR))).toBe(false);
      // userConfigDir() itself must still exist — the marker file placed directly under it
      // proves the directory was never recursively removed.
      expect(await fs.fileExists(join(USER_CONFIG_DIR, "marker"))).toBe(true);
    });

    it("leaves a cursor plugin file in place when it resolves outside the user plugins boundary through a symlink", async () => {
      const fs = new RecordingFileAdapter();
      const boundary = join(HOME, ".cursor", "plugins", "local");
      // A sibling sharing `boundary`'s name as a string prefix, not a path under it: a raw
      // `startsWith` would call it contained, where `relative()` sees the leading `..`.
      const escapeTarget = `${boundary}-evil`;
      fs.setFile(join(escapeTarget, "evil.md"), "danger");
      // The manifest's own entry names a plugin directory that, since install, became a
      // symlink escaping the declared user-scope boundary.
      fs.setSymlink(join(boundary, "rogue-plugin"), escapeTarget);
      const manifest = Manifest.create();
      manifest.addTool("cursor", "1.0.0", []);
      manifest.addPlugin(
        "cursor",
        InstalledPlugin.fromMetadata(
          "rogue-plugin",
          "1.0.0",
          { kind: "local", path: "/whatever" },
          false,
          "user"
        ).withFiles(new Map([["rogue-plugin/evil.md", "hash"]]))
      );
      const logger = new CapturingLogger();
      const useCase = new CleanUserScopeUseCase(
        fs,
        new InMemoryManifestRepository(manifest),
        logger,
        new InMemoryMarketplaceRegistry(),
        () => USER_CONFIG_DIR,
        new Map(),
        new Map(),
        () => HOME
      );

      await expect(useCase.execute({ projectRoot: "/wherever", force: true })).rejects.toThrow(
        /tracked file.*escaped/
      );

      expect(await fs.fileExists(join(escapeTarget, "evil.md"))).toBe(true);
      expect(logger.warnMessages.some((m) => m.includes("does not resolve inside"))).toBe(true);
    });
  });

  describe("binary absent", () => {
    it("names the binary and what it would have undone, without touching its own cache", async () => {
      const fs = new RecordingFileAdapter();
      const claudeCachePath = seedClaudeCache(fs);
      const logger = new CapturingLogger();
      const useCase = new CleanUserScopeUseCase(
        fs,
        new InMemoryManifestRepository(manifestWithClaude()),
        logger,
        new InMemoryMarketplaceRegistry(),
        () => USER_CONFIG_DIR,
        new Map(), // no activator registered for "claude" — the binary is absent
        new Map(),
        () => HOME
      );

      await expect(useCase.execute({ projectRoot: "/wherever", force: true })).rejects.toThrow(
        /claude.*not on the PATH.*1 marketplace.*1 plugin ref/s
      );
      // The whitelist step still purges userConfigDir()'s own cache/built/, unrelated
      // to this host's own cache — only claude's own directory must survive untouched.
      expect(fs.order).not.toContain(`deleteDirectory:${claudeCachePath}`);
      expect(await fs.fileExists(join(claudeCachePath, "marker.json"))).toBe(true);
    });
  });

  describe("confirmation", () => {
    it("names the versions built and the projects still referencing the source", async () => {
      const fs = new InMemoryFileAdapter();
      fs.setFile(
        join(USER_CONFIG_DIR, "cache", "built", "1.2.3", "aidd-framework", "claude", "x"),
        "1"
      );
      fs.setFile("/project-a/marker", "");
      const userSourceReferences = new UserSourceReferencesAdapter(fs, () => USER_CONFIG_DIR);
      await userSourceReferences.addReference("1.2.3", "/project-a");
      const useCase = new CleanUserScopeUseCase(
        fs,
        new InMemoryManifestRepository(Manifest.create()),
        new CapturingLogger(),
        new InMemoryMarketplaceRegistry(),
        () => USER_CONFIG_DIR,
        new Map(),
        new Map(),
        () => HOME,
        userSourceReferences
      );

      const result = await useCase.execute({ projectRoot: "/wherever", force: false });

      expect(result.dryRun).toBe(true);
      expect(result.preview.builtVersions).toEqual(["1.2.3"]);
      expect(result.preview.referencingProjects).toEqual(["/project-a"]);
    });

    it("ignores a referencing project whose own path no longer exists", async () => {
      const fs = new InMemoryFileAdapter();
      const userSourceReferences = new UserSourceReferencesAdapter(fs, () => USER_CONFIG_DIR);
      await userSourceReferences.addReference("1.0.0", "/gone");
      const useCase = new CleanUserScopeUseCase(
        fs,
        new InMemoryManifestRepository(Manifest.create()),
        new CapturingLogger(),
        new InMemoryMarketplaceRegistry(),
        () => USER_CONFIG_DIR,
        new Map(),
        new Map(),
        () => HOME,
        userSourceReferences
      );

      const result = await useCase.execute({ projectRoot: "/wherever", force: false });

      expect(result.preview.referencingProjects).toEqual([]);
    });

    it("--force cannot remove a shared source still referenced by a project", async () => {
      const fs = new InMemoryFileAdapter();
      fs.setFile("/project-a/marker", "");
      const userSourceReferences = new UserSourceReferencesAdapter(fs, () => USER_CONFIG_DIR);
      await userSourceReferences.addReference("1.0.0", "/project-a");
      const manifestRepo = new InMemoryManifestRepository(Manifest.create());
      const useCase = new CleanUserScopeUseCase(
        fs,
        manifestRepo,
        new CapturingLogger(),
        new InMemoryMarketplaceRegistry(),
        () => USER_CONFIG_DIR,
        new Map(),
        new Map(),
        () => HOME,
        userSourceReferences
      );

      await expect(useCase.execute({ projectRoot: "/wherever", force: true })).rejects.toThrow(
        /active projects.*\/project-a/
      );
      expect(manifestRepo.getCurrent()).not.toBeNull();
    });
  });

  describe("confirmation prompt", () => {
    it("proceeds and purges once the interactive prompt is answered yes, pinning its wording", async () => {
      const fs = new RecordingFileAdapter();
      const manifestRepo = new InMemoryManifestRepository(Manifest.create());
      const prompter = new RecordingPrompter(true);
      const useCase = new CleanUserScopeUseCase(
        fs,
        manifestRepo,
        new CapturingLogger(),
        new InMemoryMarketplaceRegistry(),
        () => USER_CONFIG_DIR,
        new Map(),
        new Map(),
        () => HOME,
        undefined,
        prompter
      );

      const result = await useCase.execute({
        projectRoot: "/wherever",
        force: false,
        interactive: true,
      });

      expect(prompter.lastConfirmMessage).toBe(
        "Remove the shared 'aidd-framework' source for this machine " +
          "(versions: none built yet)? Still referenced by: no other project."
      );
      expect(result.dryRun).toBe(false);
      expect(manifestRepo.getCurrent()).toBeNull();
    });

    it("does nothing once the interactive prompt is answered no", async () => {
      const fs = new RecordingFileAdapter();
      const manifestRepo = new InMemoryManifestRepository(Manifest.create());
      const prompter = new RecordingPrompter(false);
      const useCase = new CleanUserScopeUseCase(
        fs,
        manifestRepo,
        new CapturingLogger(),
        new InMemoryMarketplaceRegistry(),
        () => USER_CONFIG_DIR,
        new Map(),
        new Map(),
        () => HOME,
        undefined,
        prompter
      );

      const result = await useCase.execute({
        projectRoot: "/wherever",
        force: false,
        interactive: true,
      });

      expect(result.dryRun).toBe(true);
      expect(manifestRepo.getCurrent()).not.toBeNull();
      expect(fs.order).toEqual([]);
    });

    it("never asks outside an interactive run, even with a prompter wired in", async () => {
      const fs = new RecordingFileAdapter();
      const prompter = new RecordingPrompter(true);
      const useCase = new CleanUserScopeUseCase(
        fs,
        new InMemoryManifestRepository(Manifest.create()),
        new CapturingLogger(),
        new InMemoryMarketplaceRegistry(),
        () => USER_CONFIG_DIR,
        new Map(),
        new Map(),
        () => HOME,
        undefined,
        prompter
      );

      const result = await useCase.execute({ projectRoot: "/wherever", force: false });

      expect(prompter.confirmMessages).toStrictEqual([]);
      expect(result.dryRun).toBe(true);
      expect(fs.order).toStrictEqual([]);
    });

    it("names every built version and every referencing project in its question", async () => {
      const fs = new InMemoryFileAdapter();
      fs.setFile(join(USER_CONFIG_DIR, "cache", "built", "2.0.0", "aidd-framework", "x"), "1");
      fs.setFile(join(USER_CONFIG_DIR, "cache", "built", "1.2.3", "aidd-framework", "x"), "1");
      fs.setFile("/project-a/marker", "");
      fs.setFile("/project-b/marker", "");
      const userSourceReferences = new UserSourceReferencesAdapter(fs, () => USER_CONFIG_DIR);
      await userSourceReferences.addReference("1.2.3", "/project-a");
      await userSourceReferences.addReference("2.0.0", "/project-b");
      const prompter = new RecordingPrompter(false);
      const useCase = new CleanUserScopeUseCase(
        fs,
        new InMemoryManifestRepository(Manifest.create()),
        new CapturingLogger(),
        new InMemoryMarketplaceRegistry(),
        () => USER_CONFIG_DIR,
        new Map(),
        new Map(),
        () => HOME,
        userSourceReferences,
        prompter
      );

      await useCase.execute({ projectRoot: "/wherever", force: false, interactive: true });

      expect(prompter.confirmMessages).toStrictEqual([
        "Remove the shared 'aidd-framework' source for this machine " +
          "(versions: 1.2.3, 2.0.0)? Still referenced by: /project-a, /project-b.",
      ]);
    });
  });

  describe("what the run reports", () => {
    function buildClaudeUseCase(fs: InMemoryFileAdapter, logger: CapturingLogger) {
      return new CleanUserScopeUseCase(
        fs,
        new InMemoryManifestRepository(manifestWithClaude()),
        logger,
        new InMemoryMarketplaceRegistry(),
        () => USER_CONFIG_DIR,
        new Map([["claude", new FakeNativePluginActivator({ available: true })]]),
        new Map([
          [
            "claude",
            new FakeHostMarketplaceRegistryReader({
              location: "known_marketplaces.json",
              entries: new Map(),
            }),
          ],
        ]),
        () => HOME,
        undefined,
        undefined,
        provenClaudeSources(),
        provenHostPlugins(manifestWithClaude())
      );
    }

    it("reports the manifest found and the tools it named, and purges the cache the host forgot", async () => {
      const fs = new InMemoryFileAdapter();
      const claudeCachePath = seedClaudeCache(fs);
      const useCase = buildClaudeUseCase(fs, new CapturingLogger());

      const result = await useCase.execute({ projectRoot: "/wherever", force: true });

      expect(result).toStrictEqual({
        dryRun: false,
        manifestFound: true,
        preview: {
          toolIds: ["claude"],
          activePluginDependents: [],
          builtVersions: [],
          referencingProjects: [],
        },
      });
      expect(await fs.fileExists(join(claudeCachePath, "marker.json"))).toBe(false);
    });

    it("names each purge, by its label and path, and nothing about a missing user registration", async () => {
      const fs = new InMemoryFileAdapter();
      seedClaudeCache(fs);
      const logger = new CapturingLogger();
      const useCase = buildClaudeUseCase(fs, logger);

      await useCase.execute({ projectRoot: "/wherever", force: true });

      expect(logger.infoMessages).toStrictEqual([
        `claude: cache for 'aidd-framework' purged: ${join(CLAUDE_CACHE, "aidd-framework")}`,
        ...WHITELIST_PURGE_MESSAGES,
      ]);
    });

    it("reports no tool, and says plainly that nothing was registered, when no user manifest exists", async () => {
      const fs = new InMemoryFileAdapter();
      const logger = new CapturingLogger();
      const useCase = new CleanUserScopeUseCase(
        fs,
        new InMemoryManifestRepository(null),
        logger,
        new InMemoryMarketplaceRegistry(),
        () => USER_CONFIG_DIR,
        new Map(),
        new Map(),
        () => HOME
      );

      const result = await useCase.execute({ projectRoot: "/wherever", force: true });

      expect(result).toStrictEqual({
        dryRun: false,
        manifestFound: false,
        preview: {
          toolIds: [],
          activePluginDependents: [],
          builtVersions: [],
          referencingProjects: [],
        },
      });
      expect(logger.infoMessages).toStrictEqual([
        "No host registration was undone: nothing was registered at user scope.",
        ...WHITELIST_PURGE_MESSAGES,
      ]);
    });

    it("names every referencing project, comma separated, when nothing was registered here", async () => {
      const fs = new InMemoryFileAdapter();
      fs.setFile("/project-a/marker", "");
      fs.setFile("/project-b/marker", "");
      const userSourceReferences = new UserSourceReferencesAdapter(fs, () => USER_CONFIG_DIR);
      await userSourceReferences.addReference("1.0.0", "/project-a");
      await userSourceReferences.addReference("1.0.0", "/project-b");
      const logger = new CapturingLogger();
      const useCase = new CleanUserScopeUseCase(
        fs,
        new InMemoryManifestRepository(null),
        logger,
        new InMemoryMarketplaceRegistry(),
        () => USER_CONFIG_DIR,
        new Map(),
        new Map(),
        () => HOME,
        userSourceReferences
      );

      await useCase.execute({ projectRoot: "/wherever", force: false });

      expect(logger.infoMessages).toStrictEqual([
        "No host registration was undone: nothing was registered at user scope. " +
          "/project-a, /project-b still resolve the shared source through their own host; " +
          "full removal is `aidd clean` in each of them, then `aidd clean --scope user`.",
      ]);
    });

    it("refuses to interpret an unreadable references.json as no dependent project", async () => {
      const fs = new InMemoryFileAdapter();
      fs.setFile(join(USER_CONFIG_DIR, "references.json"), "not json");
      const logger = new CapturingLogger();
      const useCase = new CleanUserScopeUseCase(
        fs,
        new InMemoryManifestRepository(Manifest.create()),
        logger,
        new InMemoryMarketplaceRegistry(),
        () => USER_CONFIG_DIR,
        new Map(),
        new Map(),
        () => HOME,
        new UserSourceReferencesAdapter(fs, () => USER_CONFIG_DIR)
      );

      await expect(useCase.execute({ projectRoot: "/wherever", force: true })).rejects.toThrow(
        /Cannot read.*references.json/
      );
      expect(await fs.fileExists(join(USER_CONFIG_DIR, "references.json"))).toBe(true);
    });
  });

  describe("the versions built on this machine", () => {
    function buildPreviewUseCase(fs: InMemoryFileAdapter) {
      return new CleanUserScopeUseCase(
        fs,
        new InMemoryManifestRepository(Manifest.create()),
        new CapturingLogger(),
        new InMemoryMarketplaceRegistry(),
        () => USER_CONFIG_DIR
      );
    }

    it("lists them sorted, whatever order the cache holds them in", async () => {
      const fs = new InMemoryFileAdapter();
      fs.setFile(join(USER_CONFIG_DIR, "cache", "built", "2.0.0", "aidd-framework", "x"), "1");
      fs.setFile(join(USER_CONFIG_DIR, "cache", "built", "1.0.0", "aidd-framework", "x"), "1");

      const result = await buildPreviewUseCase(fs).execute({
        projectRoot: "/wherever",
        force: false,
      });

      expect(result.preview.builtVersions).toStrictEqual(["1.0.0", "2.0.0"]);
    });

    it("lists none when the built cache root does not exist", async () => {
      const fs = new StrictListingFileAdapter();

      const result = await buildPreviewUseCase(fs).execute({
        projectRoot: "/wherever",
        force: false,
      });

      expect(result.preview.builtVersions).toStrictEqual([]);
    });

    it("propagates a built cache root that exists but cannot be read", async () => {
      const fs = new StrictListingFileAdapter(join(USER_CONFIG_DIR, "cache", "built"));

      await expect(
        buildPreviewUseCase(fs).execute({ projectRoot: "/wherever", force: false })
      ).rejects.toThrow("permission denied");
    });
  });

  describe("driving the host CLI", () => {
    function buildUseCase(deps: {
      fs: InMemoryFileAdapter;
      logger: CapturingLogger;
      manifest?: Manifest;
      repo?: InMemoryManifestRepository;
      binary?: string;
      nativeSources?: ReadonlyMap<"claude" | "codex", NativeMarketplaceSourceReader>;
      activator: NativePluginActivator;
    }) {
      return new CleanUserScopeUseCase(
        deps.fs,
        deps.repo ?? new InMemoryManifestRepository(deps.manifest ?? manifestWithClaude()),
        deps.logger,
        new InMemoryMarketplaceRegistry(),
        () => USER_CONFIG_DIR,
        new Map([[deps.binary ?? "claude", deps.activator]]),
        new Map(),
        () => HOME,
        undefined,
        undefined,
        deps.nativeSources ?? provenClaudeSources(),
        provenHostPlugins(deps.manifest ?? manifestWithClaude())
      );
    }

    it("uninstalls every plugin ref at the user scope", async () => {
      const activator = new FakeNativePluginActivator({ available: true });
      const useCase = buildUseCase({
        fs: new InMemoryFileAdapter(),
        logger: new CapturingLogger(),
        activator,
      });

      await useCase.execute({ projectRoot: "/wherever", force: true });

      expect(activator.uninstalledPlugins).toStrictEqual(["aidd-context@aidd-framework"]);
      expect(activator.uninstalledPluginScopes).toStrictEqual(["user"]);
    });

    it("refuses a second missing native binary before uninstalling the first tool", async () => {
      const manifest = manifestWithClaude();
      manifest.addTool("copilot", "1.0.0", []);
      manifest.setNativeRegistrations("copilot", {
        binary: "copilot",
        marketplaces: [
          {
            alias: "copilot-catalog",
            hostName: "copilot-catalog",
            provenance: {
              kind: "effective-list",
              root: "/built/copilot",
              sourceType: "local",
              source: "/built/copilot",
            },
          },
        ],
        pluginRefs: [],
      });
      const repo = new InMemoryManifestRepository(manifest);
      const fs = new InMemoryFileAdapter();
      const cacheMarker = join(seedClaudeCache(fs), "marker.json");
      const before = await fs.readFile(cacheMarker);
      const claude = new FakeNativePluginActivator({ available: true });
      const useCase = buildUseCase({
        fs,
        logger: new CapturingLogger(),
        manifest,
        repo,
        activator: claude,
      });

      await expect(useCase.execute({ projectRoot: "/wherever", force: true })).rejects.toThrow(
        /copilot CLI is not on the PATH.*claims retained/
      );
      expect(claude.uninstalledPlugins).toEqual([]);
      expect(claude.removedMarketplaces).toEqual([]);
      expect(await fs.readFile(cacheMarker)).toBe(before);
      expect(repo.getCurrent()?.getNativeRegistrations("claude")?.pluginClaims).toEqual(
        manifest.getNativeRegistrations("claude")?.pluginClaims
      );
    });

    it.each(["claim", "projection"] as const)(
      "refuses an orphan machine %s before uninstalling a proven catalogue's own ref",
      async (placement) => {
        const manifest = manifestWithClaude();
        const registrations = manifest.getNativeRegistrations("claude");
        if (registrations === undefined) throw new Error("fixture missing native registration");
        manifest.setNativeRegistrations("claude", {
          ...registrations,
          pluginRefs: [...registrations.pluginRefs, "x@B"],
          pluginClaims:
            placement === "claim"
              ? [...(registrations.pluginClaims ?? []), { ref: "x@B", dependents: [] }]
              : registrations.pluginClaims,
        });
        const repo = new InMemoryManifestRepository(manifest);
        const fs = new InMemoryFileAdapter();
        const cacheMarker = join(seedClaudeCache(fs), "marker.json");
        const before = await fs.readFile(cacheMarker);
        const activator = new FakeNativePluginActivator({ available: true });
        const useCase = buildUseCase({
          fs,
          logger: new CapturingLogger(),
          manifest,
          repo,
          activator,
        });

        await expect(useCase.execute({ projectRoot: "/wherever", force: true })).rejects.toThrow(
          /x@B.*canonical catalogue/
        );
        expect(activator.uninstalledPlugins).toEqual([]);
        expect(activator.removedMarketplaces).toEqual([]);
        expect(await fs.readFile(cacheMarker)).toBe(before);
        expect(repo.getCurrent()?.getNativeRegistrations("claude")?.pluginClaims).toEqual(
          manifest.getNativeRegistrations("claude")?.pluginClaims
        );
      }
    );

    it("refuses duplicate host catalogue registrations before uninstall or cache purge", async () => {
      const manifest = manifestWithClaude();
      const registrations = manifest.getNativeRegistrations("claude");
      if (registrations === undefined) throw new Error("fixture missing native registration");
      manifest.setNativeRegistrations("claude", {
        ...registrations,
        marketplaces: [
          ...registrations.marketplaces,
          { ...registrations.marketplaces[0], alias: "second-alias" },
        ],
      });
      const repo = new InMemoryManifestRepository(manifest);
      const fs = new InMemoryFileAdapter();
      const cacheMarker = join(seedClaudeCache(fs), "marker.json");
      const before = await fs.readFile(cacheMarker);
      const activator = new FakeNativePluginActivator({ available: true });
      const useCase = buildUseCase({
        fs,
        logger: new CapturingLogger(),
        manifest,
        repo,
        activator,
      });

      await expect(useCase.execute({ projectRoot: "/wherever", force: true })).rejects.toThrow(
        /ambiguous.*aidd-framework/
      );
      expect(activator.uninstalledPlugins).toEqual([]);
      expect(activator.removedMarketplaces).toEqual([]);
      expect(await fs.readFile(cacheMarker)).toBe(before);
      expect(repo.getCurrent()?.getNativeRegistrations("claude")?.marketplaces).toEqual(
        manifest.getNativeRegistrations("claude")?.marketplaces
      );
    });

    it("aborts before marketplace removal when the host refuses plugin uninstall", async () => {
      const activator = new FakeNativePluginActivator({
        available: true,
        failOnUninstall: ["aidd-context@aidd-framework"],
      });
      const logger = new CapturingLogger();
      const useCase = buildUseCase({ fs: new InMemoryFileAdapter(), logger, activator });

      await expect(useCase.execute({ projectRoot: "/wherever", force: true })).rejects.toThrow(
        /plugin uninstall.*failed.*claims retained/
      );

      expect(logger.warnMessages).toStrictEqual([
        "claude plugin uninstall 'aidd-context@aidd-framework' failed: plugin `aidd-context@aidd-framework` is not installed",
      ]);
      expect(activator.removedMarketplaces).toStrictEqual([]);
    });

    it("unregisters every marketplace at the user scope", async () => {
      const activator = new RecordingActivator([]);
      const useCase = buildUseCase({
        fs: new InMemoryFileAdapter(),
        logger: new CapturingLogger(),
        activator,
      });

      await useCase.execute({ projectRoot: "/wherever", force: true });

      expect(activator.removedMarketplaces).toStrictEqual(["aidd-framework"]);
      expect(activator.removedMarketplaceScopes).toStrictEqual(["user"]);
    });

    it("names a refused marketplace removal by the host's own words", async () => {
      const logger = new CapturingLogger();
      const useCase = buildUseCase({
        fs: new InMemoryFileAdapter(),
        logger,
        activator: new FakeNativePluginActivator({ available: true, throwOnRemove: true }),
      });

      await expect(useCase.execute({ projectRoot: "/wherever", force: true })).rejects.toThrow(
        /marketplace remove.*failed.*claims retained/
      );

      expect(logger.warnMessages).toStrictEqual([
        "claude marketplace remove 'aidd-framework' failed: marketplace remove aidd-framework failed: 'aidd-framework' is not configured or installed",
      ]);
    });

    it("never treats a refused removal as one the host confirmed, so codex's cache stays", async () => {
      const manifest = Manifest.create();
      manifest.addTool("codex", "1.0.0", []);
      manifest.setNativeRegistrations("codex", {
        binary: "codex",
        marketplaces: [
          {
            alias: "aidd-framework",
            hostName: "aidd-framework",
            provenance: {
              kind: "effective-list",
              root: "/built/codex",
              sourceType: "local",
              source: "/built/codex",
            },
          },
        ],
        pluginRefs: [],
      });
      const fs = new InMemoryFileAdapter();
      const leftover = join(CODEX_CACHE, "aidd-framework", "leftover.json");
      fs.setFile(leftover, "{}");
      const logger = new CapturingLogger();
      const useCase = buildUseCase({
        fs,
        logger,
        manifest,
        binary: "codex",
        nativeSources: new Map([
          [
            "codex",
            {
              read: async () => ({
                location: "host",
                entries: new Map([
                  [
                    "aidd-framework",
                    {
                      kind: "effective-list" as const,
                      root: "/built/codex",
                      sourceType: "local",
                      source: "/built/codex",
                    },
                  ],
                ]),
              }),
            },
          ],
        ]),
        activator: new FakeNativePluginActivator({ available: true, throwOnRemove: true }),
      });

      await expect(useCase.execute({ projectRoot: "/wherever", force: true })).rejects.toThrow(
        /marketplace remove.*failed.*claims retained/
      );

      expect(fs.has(leftover)).toBe(true);
      expect(logger.warnMessages).toStrictEqual([
        "codex marketplace remove 'aidd-framework' failed: marketplace remove aidd-framework failed: 'aidd-framework' is not configured or installed",
      ]);
    });
  });

  describe("what an absent binary is said to leave standing", () => {
    function seedRegistrations(
      toolId: ToolId,
      marketplaces: ReadonlyArray<{ alias: string; hostName: string }>,
      pluginRefs: readonly string[]
    ): Manifest {
      const manifest = Manifest.create();
      manifest.addTool(toolId, "1.0.0", []);
      manifest.setNativeRegistrations(toolId, {
        binary: toolId,
        marketplaces: [...marketplaces],
        pluginRefs: [...pluginRefs],
        pluginClaims: pluginRefs.map((ref) => ({ ref, dependents: [] })),
      });
      return manifest;
    }

    async function errorsFor(manifest: Manifest): Promise<readonly string[]> {
      const logger = new CapturingLogger();
      const useCase = new CleanUserScopeUseCase(
        new InMemoryFileAdapter(),
        new InMemoryManifestRepository(manifest),
        logger,
        new InMemoryMarketplaceRegistry(),
        () => USER_CONFIG_DIR,
        new Map(),
        new Map(),
        () => HOME
      );
      try {
        await useCase.execute({ projectRoot: "/wherever", force: true });
        throw new Error("expected a fail-closed binary refusal");
      } catch (error) {
        return [(error as Error).message];
      }
    }

    it("names no cache for a host whose profile declares no cache directory (copilot)", async () => {
      const warnings = await errorsFor(
        seedRegistrations(
          "copilot",
          [{ alias: "aidd-framework", hostName: "aidd-framework" }],
          ["aidd-context@aidd-framework"]
        )
      );

      expect(warnings).toStrictEqual([
        "copilot: registration left in place, the copilot CLI is not on the PATH. It would have unregistered 1 marketplace(s) and 1 plugin ref(s). User clean refused; canonical claims retained.",
      ]);
    });

    it("names no cache for a tool that drives no native CLI (cursor)", async () => {
      const warnings = await errorsFor(
        seedRegistrations("cursor", [{ alias: "aidd-framework", hostName: "aidd-framework" }], [])
      );

      expect(warnings).toStrictEqual([
        "cursor: registration left in place, the cursor CLI is not on the PATH. It would have unregistered 1 marketplace(s) and 0 plugin ref(s). User clean refused; canonical claims retained.",
      ]);
    });

    it("names no cache when the binary registered no marketplace", async () => {
      const warnings = await errorsFor(
        seedRegistrations("codex", [], ["aidd-context@aidd-framework"])
      );

      expect(warnings).toStrictEqual([
        "codex: registration left in place, the codex CLI is not on the PATH. It would have unregistered 0 marketplace(s) and 1 plugin ref(s). User clean refused; canonical claims retained.",
      ]);
    });

    it("names every surviving cache, one path per marketplace", async () => {
      const warnings = await errorsFor(
        seedRegistrations(
          "codex",
          [
            { alias: "mkt-a", hostName: "mkt-a" },
            { alias: "mkt-b", hostName: "mkt-b" },
          ],
          []
        )
      );

      expect(warnings).toStrictEqual([
        `codex: registration left in place, the codex CLI is not on the PATH. It would have unregistered 2 marketplace(s) and 0 plugin ref(s). Its cache survives at: ${join(CODEX_CACHE, "mkt-a")}, ${join(CODEX_CACHE, "mkt-b")}. User clean refused; canonical claims retained.`,
      ]);
    });
  });

  describe("a plugin's own files", () => {
    it("leaves a project-scope plugin's files alone, this run owning no project", async () => {
      const fs = new RecordingFileAdapter();
      const projectFile = join("/wherever", "skills", "x.md");
      fs.setFile(projectFile, "x");
      const manifest = Manifest.create();
      manifest.addTool("cursor", "1.0.0", []);
      manifest.addPlugin(
        "cursor",
        InstalledPlugin.fromMetadata(
          "aidd-context",
          "1.0.0",
          { kind: "local", path: "/whatever" },
          false,
          "project"
        ).withFiles(new Map([["skills/x.md", "hash"]]))
      );
      const useCase = new CleanUserScopeUseCase(
        fs,
        new InMemoryManifestRepository(manifest),
        new CapturingLogger(),
        new InMemoryMarketplaceRegistry(),
        () => USER_CONFIG_DIR,
        new Map(),
        new Map(),
        () => HOME
      );

      await useCase.execute({ projectRoot: "/wherever", force: true });

      expect(fs.has(projectFile)).toBe(true);
      expect(fs.order).not.toContain(`deleteFile:${projectFile}`);
    });
  });

  describe("the cache/ shell around the whitelist", () => {
    it("leaves cache/ and everything under it in place, naming each, once cache/ resolves outside userConfigDir()", async () => {
      const fs = new RecordingFileAdapter();
      const cacheDir = join(USER_CONFIG_DIR, "cache");
      fs.setFile(join(cacheDir, "built", "1.0.0", "aidd-framework", "x"), "1");
      fs.setSymlink(cacheDir, "/elsewhere/cache");
      const logger = new CapturingLogger();
      const useCase = new CleanUserScopeUseCase(
        fs,
        new InMemoryManifestRepository(Manifest.create()),
        logger,
        new InMemoryMarketplaceRegistry(),
        () => USER_CONFIG_DIR
      );

      await useCase.execute({ projectRoot: "/wherever", force: true });

      expect(fs.has(join(cacheDir, "built", "1.0.0", "aidd-framework", "x"))).toBe(true);
      expect(logger.warnMessages).toStrictEqual([
        `user scope: cache/built does not resolve inside ${USER_CONFIG_DIR}; left in place: ${join(cacheDir, "built")}`,
        `user scope: cache/update-check.json does not resolve inside ${USER_CONFIG_DIR}; left in place: ${join(cacheDir, "update-check.json")}`,
        `user scope: cache does not resolve inside ${USER_CONFIG_DIR}; left in place: ${cacheDir}`,
      ]);
    });

    it("keeps the shell while something this whitelist never named still lives in it", async () => {
      const fs = new RecordingFileAdapter();
      const other = join(USER_CONFIG_DIR, "cache", "other.json");
      fs.setFile(other, "{}");
      const logger = new CapturingLogger();
      const useCase = new CleanUserScopeUseCase(
        fs,
        new InMemoryManifestRepository(Manifest.create()),
        logger,
        new InMemoryMarketplaceRegistry(),
        () => USER_CONFIG_DIR
      );

      await useCase.execute({ projectRoot: "/wherever", force: true });

      expect(fs.has(other)).toBe(true);
      expect(logger.infoMessages).toStrictEqual(
        WHITELIST_PURGE_MESSAGES.filter((m) => !m.startsWith("user scope: cache purged"))
      );
    });
  });
});
