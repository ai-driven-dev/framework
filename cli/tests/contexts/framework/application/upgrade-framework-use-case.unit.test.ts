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
  const saveMarketplace = vi.fn(async (_root: string, _marketplace: Marketplace) => {});
  const isPublishedRelease = vi.fn(async (_repo: string, release: string) =>
    ["v5.13.0", "v5.12.0"].includes(release)
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
    async (options: { pluginName: string; toolIds: string[]; version: string }) => {
      const id = options.toolIds[0] as "opencode" | "kilo";
      const previous = manifest.getPlugins(id).find((plugin) => plugin.name === options.pluginName);
      if (!previous) throw new Error("Missing installed plugin");
      const data = previous.toJSON();
      data.source.ref = "v5.13.0";
      data.version = options.version;
      manifest.removePlugin(id, previous.name);
      manifest.addPlugin(id, InstalledPlugin.fromJSON(data));
    }
  );
  const preflight = vi.fn(async () => {});
  const sync = vi.fn(async () => ({ errors: [], binaryMissing: [], warnings: [] }));
  const uc = new UpgradeFrameworkUseCase({
    listMarketplaces: list,
    saveMarketplace,
    loadManifest: async () => manifest,
    isPublishedRelease,
    resolveTarget: resolve,
    readTargetVersion,
    preflight,
    install,
    sync,
  });
  return {
    uc,
    original,
    manifest,
    list,
    saveMarketplace,
    isPublishedRelease,
    resolve,
    readTargetVersion,
    install,
    preflight,
    sync,
  };
}

const accept = async () => true;

describe("upgrade framework", () => {
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
      shared: true,
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
    expect(f.install.mock.calls.map(([options]) => [options.pluginName, options.toolIds])).toEqual([
      ["aidd-context", ["opencode"]],
      ["aidd-dev", ["kilo"]],
    ]);
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
