import { describe, expect, it, vi } from "vitest";
import { Marketplace } from "../../../../src/contexts/distribution/domain/marketplace.js";
import {
  type FrameworkUpgradePreview,
  UpgradeFrameworkUseCase,
} from "../../../../src/contexts/framework/application/upgrade-framework-use-case.js";
import { Manifest } from "../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import type { PluginSource } from "../../../../src/kernel/source.js";

function fixture() {
  const source = { kind: "github" as const, repo: "ai-driven-dev/framework", ref: "v5.12.0" };
  const original = Marketplace.fromJSON({
    name: "aidd-framework",
    source,
    scope: "user",
    addedAt: "2026-01-01",
    version: "5.12.0",
  });
  const manifest = Manifest.create();
  manifest.addTool("opencode", "5.6.0", []);
  manifest.addTool("kilo", "5.6.0", []);
  const pluginSource = {
    kind: "git-subdir" as const,
    url: "https://github.com/ai-driven-dev/framework.git",
    path: "plugins/aidd-context",
    ref: "v5.12.0",
  };
  manifest.addPlugin(
    "opencode",
    InstalledPlugin.fromMetadata(
      "aidd-context",
      "2.9.0",
      pluginSource,
      true,
      "project",
      "aidd-framework"
    )
  );
  manifest.addPlugin(
    "kilo",
    InstalledPlugin.fromMetadata(
      "aidd-dev",
      "2.7.0",
      { ...pluginSource, path: "plugins/aidd-dev" },
      true,
      "project",
      "aidd-framework"
    )
  );
  const list = vi.fn(async () => [original]);
  const loadUserManifest = vi.fn(async (): Promise<Manifest | null> => null);
  const saveMarketplace = vi.fn(async (_root: string, _marketplace: Marketplace) => {});
  const resolvePublishedRelease = vi.fn(async (_repo: string, release: string) =>
    ["v5.13.0", "v5.12.0"].includes(release) ? { title: "Release title" } : null
  );
  const resolve = vi.fn(
    async (): Promise<{
      catalog: {
        version: string;
        plugins: { name: string; source: PluginSource; version?: string }[];
      };
      localPath: string;
    }> => ({
      catalog: {
        version: "5.13.0",
        plugins: [
          { name: "aidd-context", source: { kind: "local", path: "./plugins/aidd-context" } },
          { name: "aidd-dev", source: { kind: "local", path: "./plugins/aidd-dev" } },
        ],
      },
      localPath: "/release",
    })
  );
  const readTargetVersion = vi.fn(async (_path: string, name: string) =>
    name === "aidd-context" ? "2.10.0" : "2.8.0"
  );
  const install = vi.fn(
    async (options: { pluginName: string; toolId: string; targetVersion?: string }) => {
      const id = options.toolId as "opencode" | "kilo";
      const previous = manifest.getPlugins(id).find((plugin) => plugin.name === options.pluginName);
      if (!previous) throw new Error("Missing installed plugin");
      const data = previous.toJSON();
      data.source.ref = "v5.13.0";
      data.version = options.targetVersion ?? "unknown";
      manifest.removePlugin(id, previous.name);
      manifest.addPlugin(id, InstalledPlugin.fromJSON(data));
    }
  );
  const verifyImpact = vi.fn(async () => {});
  const sync = vi.fn(
    async (): Promise<{
      errors: { scope: string; message: string }[];
      binaryMissing: { toolId: string; binary: string }[];
      warnings: string[];
    }> => ({ errors: [], binaryMissing: [], warnings: [] })
  );
  const prepared = { impact: [], shared: false, install, sync, verifyImpact };
  const preflight = vi.fn(
    async (): Promise<
      import("../../../../src/contexts/framework/application/release/framework-release-plan.js").FrameworkReleasePlan
    > => prepared
  );
  const uc = new UpgradeFrameworkUseCase({
    listMarketplaces: list,
    saveMarketplace,
    loadManifest: async () => manifest,
    loadUserManifest,
    resolvePublishedRelease,
    resolveTarget: resolve,
    readTargetVersion,
    preflight,
  });
  return {
    uc,
    original,
    manifest,
    loadUserManifest,
    list,
    saveMarketplace,
    resolvePublishedRelease,
    resolve,
    readTargetVersion,
    install,
    preflight,
    prepared,
    verifyImpact,
    sync,
  };
}

const accept = async () => true;

describe("upgrade framework", () => {
  it.each([
    ["local source", { source: { kind: "local", path: "/another/framework" } }],
    ["release", { source: { kind: "github", repo: "ai-driven-dev/framework", ref: "v5.99.0" } }],
    [
      "commit pin",
      {
        source: {
          kind: "github",
          repo: "ai-driven-dev/framework",
          ref: "v5.12.0",
          sha: "b".repeat(40),
        },
      },
    ],
    ["scope", { scope: "project" }],
    ["removal", null],
  ] as const)(
    "refuses a marketplace %s change during confirmation before writing",
    async (_change, patch) => {
      const f = fixture();
      const before = f.manifest.toJSON();
      const changed = patch ? [Marketplace.fromJSON({ ...f.original.toJSON(), ...patch })] : [];
      await expect(
        f.uc.execute({
          projectRoot: "/project",
          release: "v5.13.0",
          allowShared: true,
          confirm: async () => {
            f.list.mockResolvedValue(changed);
            return true;
          },
        })
      ).rejects.toThrow(/marketplace.*changed after the preview/i);
      expect(f.saveMarketplace).not.toHaveBeenCalled();
      expect(f.install).not.toHaveBeenCalled();
      expect(f.sync).not.toHaveBeenCalled();
      expect(f.manifest.toJSON()).toEqual(before);
    }
  );

  it("does not reuse the old commit pin when selecting a newer release", async () => {
    const f = fixture();
    const pinned = Marketplace.fromJSON({
      ...f.original.toJSON(),
      source: {
        kind: "github",
        repo: "ai-driven-dev/framework",
        ref: "v5.12.0",
        sha: "a".repeat(40),
      },
    });
    f.list.mockResolvedValue([pinned]);
    await f.uc.execute({
      projectRoot: "/project",
      release: "v5.13.0",
      allowShared: true,
      confirm: async () => false,
    });
    expect(f.resolve).toHaveBeenCalledWith(
      expect.objectContaining({
        source: { kind: "github", repo: "ai-driven-dev/framework", ref: "v5.13.0" },
      }),
      "/project"
    );
    expect(f.saveMarketplace).not.toHaveBeenCalled();
  });

  it("recognizes a global legacy plugin only from its exact official source", async () => {
    const f = fixture();
    const machine = Manifest.create();
    machine.addTool("opencode", "5.6.0", []);
    const source = {
      kind: "git-subdir" as const,
      url: "https://github.com/ai-driven-dev/framework.git",
      path: "plugins/aidd-context",
      ref: "v5.12.0",
    };
    machine.addPlugin(
      "opencode",
      InstalledPlugin.fromMetadata("aidd-context", "2.9.0", source, true, "user")
    );
    machine.addPlugin(
      "opencode",
      InstalledPlugin.fromMetadata(
        "aidd-dev",
        "2.7.0",
        { ...source, path: "plugins/not-aidd-dev" },
        true,
        "user"
      )
    );
    machine.addPlugin(
      "opencode",
      InstalledPlugin.fromMetadata(
        "aidd-pm",
        "1.0.0",
        { ...source, url: "https://github.com/other/framework.git", path: "plugins/aidd-pm" },
        true,
        "user"
      )
    );
    f.loadUserManifest.mockResolvedValue(machine);
    const confirm = vi.fn(async (_preview: FrameworkUpgradePreview) => false);
    await f.uc.execute({ projectRoot: "/project", release: "v5.13.0", allowShared: true, confirm });
    const preview = confirm.mock.calls[0]?.[0];
    expect(preview?.globalPlugins.map(({ pluginName }) => pluginName)).toEqual(["aidd-context"]);
    expect(f.saveMarketplace).not.toHaveBeenCalled();
  });
  it("distinguishes project user references missing from the machine inventory", async () => {
    const f = fixture();
    const source = {
      kind: "git-subdir" as const,
      url: "https://github.com/ai-driven-dev/framework.git",
      path: "plugins/aidd-extra",
      ref: "v5.12.0",
    };
    f.manifest.addTool("codex", "5.6.0", []);
    f.manifest.addPlugin(
      "codex",
      InstalledPlugin.fromMetadata("aidd-extra", "1.0.0", source, true, "user", "aidd-framework")
    );
    f.manifest.addPlugin(
      "kilo",
      InstalledPlugin.fromMetadata("aidd-extra", "1.0.0", source, true, "user", "aidd-framework")
    );
    const machine = Manifest.create();
    machine.addTool("codex", "5.6.0", []);
    machine.addPlugin(
      "codex",
      InstalledPlugin.fromMetadata("aidd-extra", "1.0.0", source, true, "user", "aidd-framework")
    );
    f.loadUserManifest.mockResolvedValue(machine);
    const confirm = vi.fn(async () => false);
    await f.uc.execute({ projectRoot: "/project", release: "v5.13.0", allowShared: true, confirm });
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ globalSkipped: 2, unverifiedUserRefs: 1 })
    );
    expect(f.saveMarketplace).not.toHaveBeenCalled();
  });
  it("previews machine installations from the user manifest without changing them", async () => {
    const f = fixture();
    const machine = Manifest.create();
    machine.addTool("opencode", "5.6.0", []);
    machine.addPlugin(
      "opencode",
      InstalledPlugin.fromMetadata(
        "aidd-context",
        "2.9.0",
        {
          kind: "git-subdir",
          url: "https://github.com/ai-driven-dev/framework.git",
          path: "plugins/aidd-context",
          ref: "v5.12.0",
        },
        true,
        "user",
        "aidd-framework"
      )
    );
    f.loadUserManifest.mockResolvedValue(machine);
    const before = machine.toJSON();
    const confirm = vi.fn(async () => false);
    await f.uc.execute({ projectRoot: "/project", release: "v5.13.0", allowShared: true, confirm });
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        globalPlugins: [
          {
            toolId: "opencode",
            pluginName: "aidd-context",
            currentVersion: "2.9.0",
            source: expect.objectContaining({ ref: "v5.12.0" }),
          },
        ],
      })
    );
    expect(machine.toJSON()).toEqual(before);
    expect(f.saveMarketplace).not.toHaveBeenCalled();
  });
  it("rechecks shared native impact before rebuilding Claude after other installations", async () => {
    const f = fixture();
    f.manifest.addTool("claude", "5.6.0", []);
    f.manifest.addPlugin("claude", f.manifest.getPlugins("opencode")[0]);
    f.preflight.mockResolvedValueOnce({ ...f.prepared, tool: "claude" });
    f.verifyImpact
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Claude installations changed"));
    await expect(
      f.uc.execute({
        projectRoot: "/project",
        release: "v5.13.0",
        allowShared: true,
        confirm: accept,
      })
    ).rejects.toThrow(/Upgrade incomplete.*Claude installations changed/);
    expect(f.verifyImpact).toHaveBeenCalledTimes(2);
    expect(f.install).toHaveBeenCalledTimes(2);
    expect(f.sync).not.toHaveBeenCalled();
  });
  it("reports updated sources separately from a failed native activation", async () => {
    const f = fixture();
    f.sync.mockResolvedValue({ errors: [], binaryMissing: [], warnings: ["catalog unavailable"] });
    await expect(
      f.uc.execute({
        projectRoot: "/project",
        release: "v5.13.0",
        allowShared: true,
        confirm: accept,
      })
    ).rejects.toThrow(/Upgrade incomplete.*Plugin sources updated:.*catalog unavailable/);
  });
  it("shows installed targets before asking, and leaves them unchanged when declined", async () => {
    const f = fixture();
    const confirm = vi.fn(async (_preview: FrameworkUpgradePreview) => false);
    const result = await f.uc.execute({
      projectRoot: "/project",
      release: "v5.13.0",
      allowShared: true,
      confirm,
    });
    expect(confirm).toHaveBeenCalledWith({
      currentRef: "v5.12.0",
      release: "v5.13.0",
      title: "Release title",
      targets: [
        {
          toolId: "opencode",
          pluginName: "aidd-context",
          currentRef: "v5.12.0",
          currentVersion: "2.9.0",
          targetVersion: "2.10.0",
        },
        {
          toolId: "kilo",
          pluginName: "aidd-dev",
          currentRef: "v5.12.0",
          currentVersion: "2.7.0",
          targetVersion: "2.8.0",
        },
      ],
      globalSkipped: 0,
      unverifiedUserRefs: 0,
      globalPlugins: [],
      shared: true,
      impact: [],
    });
    expect(result.cancelled).toBe(true);
    expect(f.saveMarketplace).not.toHaveBeenCalled();
    expect(f.install).not.toHaveBeenCalled();
  });

  it("shows a pinned plugin ref even when the marketplace is already at the target release", async () => {
    const f = fixture();
    const data = f.original.toJSON();
    data.source.ref = "v5.13.0";
    data.version = "5.13.0";
    f.list.mockResolvedValue([Marketplace.fromJSON(data)]);
    f.resolve.mockResolvedValue({
      localPath: "/release",
      catalog: {
        version: "5.13.0",
        plugins: [
          {
            name: "aidd-context",
            source: { kind: "local", path: "./plugins/aidd-context" },
            version: "2.10.0",
          },
          { name: "aidd-dev", source: { kind: "local", path: "./plugins/aidd-dev" } },
        ],
      },
    });
    const confirm = vi.fn(async (_preview: FrameworkUpgradePreview) => false);
    await f.uc.execute({ projectRoot: "/project", release: "v5.13.0", allowShared: true, confirm });
    expect(confirm.mock.calls[0][0]).toMatchObject({
      currentRef: "v5.13.0",
      release: "v5.13.0",
      targets: [
        {
          toolId: "opencode",
          pluginName: "aidd-context",
          currentRef: "v5.12.0",
          currentVersion: "2.9.0",
          targetVersion: "2.10.0",
        },
        {
          toolId: "kilo",
          pluginName: "aidd-dev",
          currentRef: "v5.12.0",
          currentVersion: "2.7.0",
          targetVersion: "2.8.0",
        },
      ],
    });
  });

  it("refuses a shared marketplace change without explicit selection", async () => {
    const f = fixture();
    await expect(
      f.uc.execute({
        projectRoot: "/project",
        release: "v5.13.0",
        allowShared: false,
        confirm: accept,
      })
    ).rejects.toThrow(/shared/i);
    expect(f.saveMarketplace).not.toHaveBeenCalled();
    expect(f.install).not.toHaveBeenCalled();
  });

  it("upgrades only each existing project plugin/tool pair", async () => {
    const f = fixture();
    const result = await f.uc.execute({
      projectRoot: "/project",
      release: "v5.13.0",
      allowShared: true,
      confirm: accept,
    });
    expect(f.saveMarketplace).toHaveBeenCalledOnce();
    expect(f.saveMarketplace.mock.calls[0][1].version).toBe("5.13.0");
    expect(f.preflight).toHaveBeenCalledOnce();
    expect(f.install.mock.calls.map(([options]) => [options.pluginName, [options.toolId]])).toEqual(
      [
        ["aidd-context", ["opencode"]],
        ["aidd-dev", ["kilo"]],
      ]
    );
    expect(f.sync).toHaveBeenCalledOnce();
    expect(result.updated).toEqual(["opencode:aidd-context", "kilo:aidd-dev"]);
  });

  it("rejects a local source without changing its registration", async () => {
    const f = fixture();
    f.list.mockResolvedValue([
      Marketplace.fromJSON({
        name: "aidd-framework",
        source: { kind: "local", path: "/local/framework" },
        scope: "user",
        addedAt: "2026-01-01",
      }),
    ]);
    await expect(
      f.uc.execute({
        projectRoot: "/project",
        release: "v5.13.0",
        allowShared: true,
        confirm: accept,
      })
    ).rejects.toThrow(/local|source/i);
    expect(f.saveMarketplace).not.toHaveBeenCalled();
  });

  it("stops before changing the marketplace if preflight reports modified files", async () => {
    const f = fixture();
    f.preflight.mockRejectedValue(new Error("modified plugin files"));
    await expect(
      f.uc.execute({
        projectRoot: "/project",
        release: "v5.13.0",
        allowShared: true,
        confirm: accept,
      })
    ).rejects.toThrow(/modified/);
    expect(f.saveMarketplace).not.toHaveBeenCalled();
  });

  it("refuses an unavailable or non-root release", async () => {
    const f = fixture();
    await expect(
      f.uc.execute({
        projectRoot: "/project",
        release: "v999.0.0",
        allowShared: true,
        confirm: accept,
      })
    ).rejects.toThrow(/release/i);
    await expect(
      f.uc.execute({
        projectRoot: "/project",
        release: "aidd-dev-v5.13.0",
        allowShared: true,
        confirm: accept,
      })
    ).rejects.toThrow(/release/i);
    expect(f.saveMarketplace).not.toHaveBeenCalled();
  });

  it("refuses a target release that would downgrade an installed plugin", async () => {
    const f = fixture();
    const previous = f.manifest.getPlugins("opencode")[0];
    const data = previous.toJSON();
    data.version = "3.0.0";
    f.manifest.removePlugin("opencode", previous.name);
    f.manifest.addPlugin("opencode", InstalledPlugin.fromJSON(data));
    f.resolve.mockResolvedValue({
      localPath: "/release",
      catalog: {
        version: "5.13.0",
        plugins: [
          {
            name: "aidd-context",
            source: { kind: "local", path: "./plugins/aidd-context" },
            version: "2.10.0",
          },
          { name: "aidd-dev", source: { kind: "local", path: "./plugins/aidd-dev" } },
        ],
      },
    });
    await expect(
      f.uc.execute({
        projectRoot: "/project",
        release: "v5.13.0",
        allowShared: true,
        confirm: accept,
      })
    ).rejects.toThrow(/downgrade/i);
    expect(f.saveMarketplace).not.toHaveBeenCalled();
    expect(f.install).not.toHaveBeenCalled();
  });

  it("refuses an independently sourced plugin before changing the marketplace", async () => {
    const f = fixture();
    const previous = f.manifest.getPlugins("opencode")[0];
    const data = previous.toJSON();
    data.source = { kind: "local", path: "/local/custom" };
    f.manifest.removePlugin("opencode", previous.name);
    f.manifest.addPlugin("opencode", InstalledPlugin.fromJSON(data));
    await expect(
      f.uc.execute({
        projectRoot: "/project",
        release: "v5.13.0",
        allowShared: true,
        confirm: accept,
      })
    ).rejects.toThrow(/source/i);
    expect(f.saveMarketplace).not.toHaveBeenCalled();
  });

  it("refuses a target catalogue that redirects the plugin to another path", async () => {
    const f = fixture();
    f.resolve.mockResolvedValue({
      localPath: "/release",
      catalog: {
        version: "5.13.0",
        plugins: [
          { name: "aidd-context", source: { kind: "local", path: "./plugins/other" } },
          { name: "aidd-dev", source: { kind: "local", path: "./plugins/aidd-dev" } },
        ],
      },
    });
    await expect(
      f.uc.execute({
        projectRoot: "/project",
        release: "v5.13.0",
        allowShared: true,
        confirm: accept,
      })
    ).rejects.toThrow(/source/i);
    expect(f.saveMarketplace).not.toHaveBeenCalled();
    expect(f.install).not.toHaveBeenCalled();
  });

  it("refuses a catalog and plugin version mismatch before changing the marketplace", async () => {
    const f = fixture();
    f.resolve.mockResolvedValue({
      localPath: "/release",
      catalog: {
        version: "5.13.0",
        plugins: [
          {
            name: "aidd-context",
            source: { kind: "local", path: "./plugins/aidd-context" },
            version: "1.0.0",
          },
          { name: "aidd-dev", source: { kind: "local", path: "./plugins/aidd-dev" } },
        ],
      },
    });
    const confirm = vi.fn(accept);
    await expect(
      f.uc.execute({ projectRoot: "/project", release: "v5.13.0", allowShared: true, confirm })
    ).rejects.toThrow(/catalog version/i);
    expect(confirm).not.toHaveBeenCalled();
    expect(f.saveMarketplace).not.toHaveBeenCalled();
    expect(f.install).not.toHaveBeenCalled();
  });

  it("does not report success when an install leaves its old source ref", async () => {
    const f = fixture();
    f.install.mockImplementation(async (_options) => {});
    await expect(
      f.uc.execute({
        projectRoot: "/project",
        release: "v5.13.0",
        allowShared: true,
        confirm: accept,
      })
    ).rejects.toThrow(/incomplete|verif/i);
  });

  it("reports partial execution when a plugin cannot be upgraded", async () => {
    const f = fixture();
    f.install.mockRejectedValueOnce(new Error("install failed"));
    await expect(
      f.uc.execute({
        projectRoot: "/project",
        release: "v5.13.0",
        allowShared: true,
        confirm: accept,
      })
    ).rejects.toThrow(/partial|incomplete/i);
    expect(f.sync).not.toHaveBeenCalled();
  });
});
