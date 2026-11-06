import "../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/kilo/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import type { PinnedUserFramework } from "../../../../../src/contexts/framework/application/ownership/release/pinned-user-framework.js";
import { UpgradeUserFrameworkUseCase } from "../../../../../src/contexts/framework/application/ownership/release/upgrade-user-framework-use-case.js";
import { UserReleaseJournal } from "../../../../../src/contexts/framework/application/ownership/release/user-release-journal.js";
import { UserPluginFileUpdater } from "../../../../../src/contexts/framework/application/ownership/user-plugin-file-updater.js";
import { PluginDistributionLoader } from "../../../../../src/contexts/framework/application/plugin/plugin-distribution-loader.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { PluginDistribution } from "../../../../../src/contexts/translate/domain/plugin-distribution.js";
import { InstallationFile } from "../../../../../src/kernel/file.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { FixturePluginFetcher } from "../../../../helpers/ports/fixture-plugin-fetcher.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";

const SHA = "1".repeat(40);
const HOME = "/test-home";
const PROJECT = "/current-project";
const FILE = "skills/aidd-context/00-onboard/SKILL.md";
const SOURCE = {
  kind: "git-subdir" as const,
  url: "https://github.com/ai-driven-dev/framework.git",
  path: "plugins/aidd-context",
  ref: "v5.12.0",
};

async function fixture(options: { currentRef?: string; targetVersion?: string } = {}) {
  const hasher = new DeterministicHasher();
  const fs = new InMemoryFileAdapter({}, hasher);
  const logger = new CapturingLogger();
  const manifest = Manifest.create();
  const registry = new InMemoryMarketplaceRegistry();
  const marketplace = Marketplace.fromJSON({
    name: "aidd-framework",
    source: { kind: "github", repo: "ai-driven-dev/framework", ref: "v5.12.0" },
    scope: "user",
    addedAt: "2026-01-01",
    version: "5.12.0",
  });
  await registry.save(PROJECT, marketplace);
  for (const tool of ["opencode", "kilo"] as const) {
    manifest.addTool(tool, "5.0.0", []);
    const plugin = InstalledPlugin.fromMetadata(
      "aidd-context",
      "2.9.0",
      { ...SOURCE, ref: options.currentRef ?? SOURCE.ref },
      true,
      "user",
      "aidd-framework"
    )
      .withFiles(new Map([[FILE, hasher.hash("old").value]]))
      .withDependents(["/project-a", "/project-b"]);
    manifest.addPlugin(tool, plugin);
    await fs.writeFile(join(HOME, ".config", tool, FILE), "old");
  }
  manifest.addTool("codex", "1.0.0", []);
  manifest.setNativeRegistrations("codex", {
    binary: "codex",
    marketplaces: [],
    pluginRefs: ["aidd-context@aidd-framework", "other@different"],
    pluginClaims: [
      { ref: "aidd-context@aidd-framework", dependents: ["/native-project"] },
      { ref: "other@different", dependents: [] },
    ],
  });
  const native = manifest.getNativeRegistrations("codex");
  const repo = new InMemoryManifestRepository(manifest);
  const dist = new PluginDistribution({
    manifest: { name: "aidd-context", version: options.targetVersion ?? "2.10.0" },
    format: "claude",
    files: [],
    components: { skills: [], commands: [], agents: [], rules: [], hooks: [], mcp: [] },
  });
  const file = new InstallationFile({
    relativePath: FILE,
    content: "new",
    hash: hasher.hash("new"),
  });
  const build = vi.fn<PinnedUserFramework["build"]>(async () => ({
    sha: SHA,
    dist,
    files: [file],
  }));
  const sessionEvents: string[] = [];
  const builder: PinnedUserFramework = {
    build,
    async withSession<T>(action: (session: PinnedUserFramework) => Promise<T>): Promise<T> {
      sessionEvents.push("opened");
      try {
        return await action({ build });
      } finally {
        sessionEvents.push("closed");
      }
    },
  };
  const updater = new UserPluginFileUpdater(
    fs,
    new PluginDistributionLoader(new FixturePluginFetcher(), { read: async () => dist }),
    hasher,
    {
      ensureBuilt: fakeEnsureBuiltMarketplace(),
      marketplaceRegistry: registry,
      homedir: () => HOME,
    }
  );
  let journalContent: string | null = null;
  const store = {
    read: vi.fn(async () => journalContent),
    create: vi.fn(async (content: string) => {
      journalContent = content;
    }),
    remove: vi.fn(async () => {
      journalContent = null;
    }),
  };
  const journal = new UserReleaseJournal(fs, hasher, repo, { home: () => HOME, store });
  const resolvePublishedRelease = vi.fn(
    async (_repo: string, _release: string): Promise<{ title: string | null } | null> => ({
      title: "Release title",
    })
  );
  const useCase = new UpgradeUserFrameworkUseCase({
    repo,
    builder,
    updater,
    journal,
    logger,
    resolvePublishedRelease,
  });
  const writes = vi.spyOn(fs, "writeFile");
  const deletes = vi.spyOn(fs, "deleteFile");
  return {
    useCase,
    repo,
    manifest,
    registry,
    marketplace,
    native,
    fs,
    store,
    build,
    sessionEvents,
    updater,
    resolvePublishedRelease,
    writes,
    deletes,
  };
}

const accept = async () => true;

describe("machine-scoped framework release update", () => {
  it("previews versions, refs, dependents and skipped native claims without mutation when declined", async () => {
    const f = await fixture();
    const before = f.manifest.toJSON();
    const confirm = vi.fn(async () => false);
    const result = await f.useCase.execute({ projectRoot: PROJECT, release: "v5.13.0", confirm });
    expect(f.sessionEvents).toEqual(["opened", "closed"]);
    expect(confirm).toHaveBeenCalledWith({
      release: "v5.13.0",
      title: "Release title",
      nativeSkipped: 1,
      targets: ["opencode", "kilo"].map((toolId) => ({
        toolId,
        name: "aidd-context",
        currentRef: "v5.12.0",
        currentVersion: "2.9.0",
        targetVersion: "2.10.0",
        dependents: ["/project-a", "/project-b"],
      })),
    });
    expect(result).toEqual({ updated: [], nativeSkipped: 1, cancelled: true });
    expect(f.repo.getCurrent()?.toJSON()).toEqual(before);
    expect(f.repo.saveCount).toBe(0);
    expect(f.store.create).not.toHaveBeenCalled();
    expect(f.writes).not.toHaveBeenCalled();
    expect(f.deletes).not.toHaveBeenCalled();
    expect((await f.registry.list(PROJECT))[0]?.toJSON()).toEqual(f.marketplace.toJSON());
  });

  it("commits only flat-owned plugins at the same pinned commit and preserves native claims and marketplace", async () => {
    const f = await fixture();
    const result = await f.useCase.execute({
      projectRoot: PROJECT,
      release: "v5.13.0",
      confirm: accept,
    });
    expect(result).toEqual({
      updated: ["opencode:aidd-context", "kilo:aidd-context"],
      nativeSkipped: 1,
      cancelled: false,
    });
    expect(f.build).toHaveBeenNthCalledWith(1, "v5.13.0", "opencode", "aidd-context", undefined);
    expect(f.build).toHaveBeenNthCalledWith(2, "v5.13.0", "kilo", "aidd-context", SHA);
    expect(f.resolvePublishedRelease).toHaveBeenCalledWith("ai-driven-dev/framework", "v5.13.0");
    for (const tool of ["opencode", "kilo"] as const) {
      const plugin = f.repo.getCurrent()?.getPlugins(tool)[0];
      expect(plugin?.source).toEqual({ ...SOURCE, ref: "v5.13.0", sha: SHA });
      expect(plugin?.version).toBe("2.10.0");
      expect(plugin?.dependents).toEqual(["/project-a", "/project-b"]);
      expect(await f.fs.readFile(join(HOME, ".config", tool, FILE))).toBe("new");
    }
    expect(f.repo.getCurrent()?.getNativeRegistrations("codex")).toEqual(f.native);
    expect((await f.registry.list(PROJECT))[0]?.toJSON()).toEqual(f.marketplace.toJSON());
    expect(f.store.create).toHaveBeenCalledTimes(2);
    expect(f.store.remove).toHaveBeenCalledTimes(2);
  });

  it.each([
    { kind: "local", path: "/checkout" },
    { ...SOURCE, url: "https://example.com/foreign.git" },
    { ...SOURCE, path: "plugins/other" },
    { ...SOURCE, ref: "main" },
  ])("refuses a non-official or unpinned source before changing files: %s", async (source) => {
    const f = await fixture();
    const old = f.manifest.getPlugins("opencode")[0];
    f.manifest.updatePlugin("opencode", InstalledPlugin.fromJSON({ ...old.toJSON(), source }));
    await expect(
      f.useCase.execute({ projectRoot: PROJECT, release: "v5.13.0", confirm: accept })
    ).rejects.toThrow(/pinned official/);
    expect(f.build).not.toHaveBeenCalled();
    expect(f.store.create).not.toHaveBeenCalled();
    expect(f.writes).not.toHaveBeenCalled();
    expect(f.repo.saveCount).toBe(0);
  });

  it("refuses a downgrade before changing files", async () => {
    const f = await fixture();
    await expect(
      f.useCase.execute({ projectRoot: PROJECT, release: "v5.11.0", confirm: accept })
    ).rejects.toThrow(/downgrade/);
    expect(f.store.create).not.toHaveBeenCalled();
    expect(f.writes).not.toHaveBeenCalled();
    expect(f.repo.saveCount).toBe(0);
  });

  it.each([
    { currentRef: "v5.12.0", target: "v5.13.0-beta.1" },
    { currentRef: "v5.12.0-alpha.1", target: "v5.13.0-beta.1" },
  ])(
    "updates to an explicitly selected channel after confirmation ($currentRef → $target)",
    async ({ currentRef, target }) => {
      const declined = await fixture({ currentRef });
      const confirm = vi.fn(async () => false);
      const cancelled = await declined.useCase.execute({
        projectRoot: PROJECT,
        release: target,
        confirm,
      });
      expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ release: target }));
      expect(cancelled.cancelled).toBe(true);
      expect(declined.store.create).not.toHaveBeenCalled();
      expect(declined.writes).not.toHaveBeenCalled();

      const accepted = await fixture({ currentRef });
      const result = await accepted.useCase.execute({
        projectRoot: PROJECT,
        release: target,
        confirm: accept,
      });
      expect(result.updated).toHaveLength(2);
      expect(accepted.repo.getCurrent()?.getPlugins("opencode")[0]?.source).toEqual({
        ...SOURCE,
        ref: target,
        sha: SHA,
      });
    }
  );

  it("accepts a newer release on the existing prerelease channel", async () => {
    const f = await fixture({ currentRef: "v5.12.0-beta.1" });
    const result = await f.useCase.execute({
      projectRoot: PROJECT,
      release: "v5.13.0-beta.1",
      confirm: accept,
    });
    expect(result.updated).toHaveLength(2);
    expect(f.repo.getCurrent()?.getPlugins("opencode")[0]?.source).toEqual({
      ...SOURCE,
      ref: "v5.13.0-beta.1",
      sha: SHA,
    });
  });

  it("treats build metadata as part of neither prerelease channel nor version ordering", async () => {
    const f = await fixture({ currentRef: "v5.12.0+build-1" });
    const result = await f.useCase.execute({
      projectRoot: PROJECT,
      release: "v5.13.0+build-2",
      confirm: accept,
    });
    expect(result.updated).toHaveLength(2);
  });

  it("refuses a target with an older plugin version or an unpublished release", async () => {
    const old = await fixture({ targetVersion: "2.8.0" });
    await expect(
      old.useCase.execute({ projectRoot: PROJECT, release: "v5.13.0", confirm: accept })
    ).rejects.toThrow(/plugin downgrade/);
    expect(old.store.create).not.toHaveBeenCalled();
    const unpublished = await fixture();
    unpublished.resolvePublishedRelease.mockResolvedValue(null);
    await expect(
      unpublished.useCase.execute({ projectRoot: PROJECT, release: "v5.13.0", confirm: accept })
    ).rejects.toThrow(/not available/);
    expect(unpublished.build).not.toHaveBeenCalled();
    expect(unpublished.store.create).not.toHaveBeenCalled();
  });

  it.each(["5.13.0", "vnot-a-release", "main"])(
    "refuses invalid release %s before checking the network or changing files",
    async (release) => {
      const f = await fixture();
      const confirm = vi.fn(accept);
      await expect(f.useCase.execute({ projectRoot: PROJECT, release, confirm })).rejects.toThrow(
        /root release tag/
      );
      expect(f.resolvePublishedRelease).not.toHaveBeenCalled();
      expect(confirm).not.toHaveBeenCalled();
      expect(f.writes).not.toHaveBeenCalled();
      expect(f.repo.saveCount).toBe(0);
    }
  );

  it("refuses a missing machine manifest before inspecting releases", async () => {
    const f = await fixture();
    await f.repo.delete();
    await expect(
      f.useCase.execute({ projectRoot: PROJECT, release: "v5.13.0", confirm: accept })
    ).rejects.toThrow("No machine installation manifest");
    expect(f.resolvePublishedRelease).not.toHaveBeenCalled();
    expect(f.writes).not.toHaveBeenCalled();
  });

  it("refuses when only native claims or unrelated marketplace plugins remain", async () => {
    const f = await fixture();
    f.manifest.removePlugin("opencode", "aidd-context");
    f.manifest.removePlugin("kilo", "aidd-context");
    f.manifest.addPlugin(
      "opencode",
      InstalledPlugin.fromMetadata("third-party", "1.0.0", SOURCE, true, "user", "other")
    );
    const confirm = vi.fn(accept);
    await expect(
      f.useCase.execute({ projectRoot: PROJECT, release: "v5.13.0", confirm })
    ).rejects.toThrow("No flat machine-scoped AIDD plugins");
    expect(confirm).not.toHaveBeenCalled();
    expect(f.sessionEvents).toEqual(["opened", "closed"]);
    expect(f.build).not.toHaveBeenCalled();
    expect(f.writes).not.toHaveBeenCalled();
    expect(f.repo.getCurrent()?.getNativeRegistrations("codex")).toEqual(f.native);
  });

  it("does not update either tool when the second tool's tracked file was edited", async () => {
    const f = await fixture();
    const path = join(HOME, ".config", "kilo", FILE);
    await f.fs.writeFile(path, "user edit");
    f.writes.mockClear();
    const confirm = vi.fn(accept);
    await expect(
      f.useCase.execute({ projectRoot: PROJECT, release: "v5.13.0", confirm })
    ).rejects.toThrow();
    expect(confirm).not.toHaveBeenCalled();
    expect(f.store.create).not.toHaveBeenCalled();
    expect(f.writes).not.toHaveBeenCalled();
    expect(await f.fs.readFile(path)).toBe("user edit");
    expect(await f.fs.readFile(join(HOME, ".config", "opencode", FILE))).toBe("old");
    expect(f.repo.saveCount).toBe(0);
  });

  it("reports the completed tool if the next journal cannot be created", async () => {
    const f = await fixture();
    f.store.create
      .mockImplementationOnce(async () => {})
      .mockRejectedValueOnce(new Error("disk full"));
    const operation = f.useCase.execute({
      projectRoot: PROJECT,
      release: "v5.13.0",
      confirm: accept,
    });
    await expect(operation).rejects.toThrow("Completed: opencode:aidd-context");
    expect(f.repo.getCurrent()?.getPlugins("opencode")[0]?.version).toBe("2.10.0");
    expect(f.repo.getCurrent()?.getPlugins("kilo")[0]?.version).toBe("2.9.0");
    expect(await f.fs.readFile(join(HOME, ".config", "kilo", FILE))).toBe("old");
  });

  it.each([
    {
      contribution: "MCP entries",
      add: (p: InstalledPlugin) =>
        InstalledPlugin.withMcpEntries(p, new Map([["server", "a".repeat(32)]])),
    },
    {
      contribution: "project hooks",
      add: (p: InstalledPlugin) =>
        InstalledPlugin.withProjectHooks(p, { entries: [], scripts: new Map() }),
    },
    {
      contribution: "component paths",
      add: (p: InstalledPlugin) =>
        InstalledPlugin.fromJSON({ ...p.toJSON(), componentPaths: { skill: "skills/example" } }),
    },
  ])("refuses unsupported machine $contribution before preview", async ({ add }) => {
    const f = await fixture();
    const plugin = f.manifest.getPlugins("opencode")[0];
    f.manifest.updatePlugin("opencode", add(plugin));
    const confirm = vi.fn(accept);
    await expect(
      f.useCase.execute({ projectRoot: PROJECT, release: "v5.13.0", confirm })
    ).rejects.toThrow("machine ownership includes unsupported contributions");
    expect(confirm).not.toHaveBeenCalled();
    expect(f.store.create).not.toHaveBeenCalled();
    expect(f.writes).not.toHaveBeenCalled();
    expect(f.repo.saveCount).toBe(0);
  });

  it("updates only user-scoped flat copies and leaves a project-scoped plugin untouched", async () => {
    const f = await fixture();
    const projectPlugin = InstalledPlugin.fromJSON({
      ...f.manifest.getPlugins("kilo")[0].toJSON(),
      scope: "project",
    });
    f.manifest.updatePlugin("kilo", projectPlugin);
    f.manifest.addPlugin(
      "codex",
      InstalledPlugin.fromMetadata("aidd-context", "2.9.0", SOURCE, true, "user", "aidd-framework")
    );
    const result = await f.useCase.execute({
      projectRoot: PROJECT,
      release: "v5.13.0",
      confirm: accept,
    });
    expect(result.updated).toEqual(["opencode:aidd-context"]);
    expect(f.repo.getCurrent()?.getPlugins("kilo")[0]?.toJSON()).toEqual(projectPlugin.toJSON());
    expect(await f.fs.readFile(join(HOME, ".config", "kilo", FILE))).toBe("old");
    expect(f.repo.getCurrent()?.getPlugins("codex")[0]?.source).toEqual(SOURCE);
  });

  it("advances a framework ref even when the plugin version itself is unchanged", async () => {
    const f = await fixture({ targetVersion: "2.9.0" });
    const result = await f.useCase.execute({
      projectRoot: PROJECT,
      release: "v5.13.0",
      confirm: accept,
    });
    expect(result.updated).toHaveLength(2);
    expect(f.repo.getCurrent()?.getPlugins("opencode")[0]?.source).toEqual({
      ...SOURCE,
      ref: "v5.13.0",
      sha: SHA,
    });
  });

  it("accepts reapplying the current release to bring a lagging plugin version up to date", async () => {
    const f = await fixture();
    const result = await f.useCase.execute({
      projectRoot: PROJECT,
      release: "v5.12.0",
      confirm: accept,
    });
    expect(result.updated).toHaveLength(2);
    expect(f.repo.getCurrent()?.getPlugins("opencode")[0]?.version).toBe("2.10.0");
    expect(f.repo.getCurrent()?.getPlugins("opencode")[0]?.source).toEqual({ ...SOURCE, sha: SHA });
  });

  it("refuses to proceed if a machine plugin update cannot be planned", async () => {
    const f = await fixture();
    vi.spyOn(f.updater, "planUpdate").mockResolvedValue(null);
    const confirm = vi.fn(accept);
    await expect(
      f.useCase.execute({ projectRoot: PROJECT, release: "v5.13.0", confirm })
    ).rejects.toThrow("unable to plan machine update");
    expect(confirm).not.toHaveBeenCalled();
    expect(f.store.create).not.toHaveBeenCalled();
    expect(f.writes).not.toHaveBeenCalled();
    expect(f.repo.saveCount).toBe(0);
  });

  it("refuses a change to a shared TUI configuration before asking for confirmation", async () => {
    const f = await fixture();
    const original = f.updater.planUpdate.bind(f.updater);
    vi.spyOn(f.updater, "planUpdate").mockImplementation(async (...args) => {
      const plan = await original(...args);
      return plan === null
        ? null
        : {
            ...plan,
            next: plan.next.withTuiPlugin({
              config: "tui.jsonc",
              entry: "./hooks/aidd-maintenance/kilo-tui.js",
            }),
          };
    });
    const confirm = vi.fn(accept);
    await expect(
      f.useCase.execute({ projectRoot: PROJECT, release: "v5.13.0", confirm })
    ).rejects.toThrow("change a shared TUI configuration");
    expect(confirm).not.toHaveBeenCalled();
    expect(f.store.create).not.toHaveBeenCalled();
    expect(f.writes).not.toHaveBeenCalled();
    expect(f.repo.saveCount).toBe(0);
  });
});
