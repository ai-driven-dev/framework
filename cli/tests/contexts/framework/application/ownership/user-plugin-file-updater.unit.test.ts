import "../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/kilo/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import type { PinnedUserFramework } from "../../../../../src/contexts/framework/application/ownership/release/pinned-user-framework.js";
import { UserPluginFileUpdater } from "../../../../../src/contexts/framework/application/ownership/user-plugin-file-updater.js";
import { PluginDistributionLoader } from "../../../../../src/contexts/framework/application/plugin/plugin-distribution-loader.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { PluginDistribution } from "../../../../../src/contexts/translate/domain/plugin-distribution.js";
import { InstallationFile } from "../../../../../src/kernel/file.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { FixturePluginFetcher } from "../../../../helpers/ports/fixture-plugin-fetcher.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";

function fixture(installedVersion = "0.0.1") {
  const fs = new InMemoryFileAdapter();
  const hasher = new DeterministicHasher();
  const logger = new CapturingLogger();
  const content = "# Updated skill";
  const skill = { relativePath: "skills/demo/SKILL.md", content };
  const dist = new PluginDistribution({
    manifest: { name: "sample-plugin", version: "1.0.0" },
    format: "claude",
    files: [skill],
    components: { commands: [], agents: [], rules: [], skills: [skill], hooks: [], mcp: [] },
  });
  const updater = new UserPluginFileUpdater(
    fs,
    new PluginDistributionLoader(new FixturePluginFetcher(), { read: async () => dist }),
    hasher
  );
  const plugin = InstalledPlugin.fromMetadata(
    "sample-plugin",
    installedVersion,
    { kind: "local", path: "/source" },
    false,
    "user"
  ).withDependents(["/A", "/B"]);
  const base = join(homedir(), ".cursor/plugins/local");
  return { fs, hasher, logger, updater, plugin, base, content };
}

describe("UserPluginFileUpdater public update contract", () => {
  it("writes back a recorded file that was deleted", async () => {
    const f = fixture();
    const path = "sample-plugin/skills/demo/SKILL.md";
    const owned = f.plugin.withFiles(new Map([[path, f.hasher.hash(f.content).value]]));

    const result = await f.updater.update(owned, "cursor", "/A", f.logger);

    expect(await f.fs.readFile(join(f.base, path))).toBe(f.content);
    expect(result?.files.has(path)).toBe(true);
    expect(f.logger.warnMessages.filter((m) => m.includes("left in place"))).toEqual([]);
  });

  it("refuses to rebuild global files without the shared source, rather than write a project's layout", async () => {
    const f = fixture();
    await expect(f.updater.update(f.plugin, "opencode", "/A", f.logger)).rejects.toThrow(
      "run `aidd setup --global`"
    );
  });

  it("rebuilds a pinned machine plugin from its recorded commit, not the shared marketplace", async () => {
    const fs = new InMemoryFileAdapter();
    const hasher = new DeterministicHasher();
    const logger = new CapturingLogger();
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      "/project",
      Marketplace.create({
        name: "aidd-framework",
        source: { kind: "github", repo: "ai-driven-dev/framework", ref: "v5.12.0" },
        scope: "user",
        addedAt: "2026-01-01",
      })
    );
    const content = "# pinned release";
    const file = new InstallationFile({
      relativePath: "skills/aidd-context/test/SKILL.md",
      content,
      hash: hasher.hash(content),
    });
    const dist = new PluginDistribution({
      manifest: { name: "aidd-context", version: "2.10.0" },
      format: "claude",
      files: [],
      components: { commands: [], agents: [], rules: [], skills: [], hooks: [], mcp: [] },
    });
    const sha = "a".repeat(40);
    let rebuilt = "";
    const pinned: PinnedUserFramework = {
      async build(ref, toolId, pluginName, commit) {
        rebuilt = `${ref}:${toolId}:${pluginName}:${commit}`;
        return { sha, dist, files: [file] };
      },
    };
    const updater = new UserPluginFileUpdater(
      fs,
      new PluginDistributionLoader(new FixturePluginFetcher(), {
        read: async () => {
          throw new Error("must not fetch the shared plugin source");
        },
      }),
      hasher,
      {
        ensureBuilt: {
          execute: async () => {
            throw new Error("must not build the shared marketplace");
          },
        },
        marketplaceRegistry: registry,
        homedir: () => "/home/user",
        pinnedFramework: pinned,
      }
    );
    const source = {
      kind: "git-subdir",
      url: "https://github.com/ai-driven-dev/framework.git",
      path: "plugins/aidd-context",
      ref: "v5.13.0",
      sha,
    } as const;
    const plugin = InstalledPlugin.fromMetadata(
      "aidd-context",
      "2.10.0",
      source,
      false,
      "user",
      "aidd-framework"
    );
    const plan = await updater.planUpdate(plugin, "opencode", "/project", logger, true);
    if (!plan) throw new Error("expected rebuild plan");
    const next = await updater.applyUpdate(plan, logger);
    expect(rebuilt).toBe(`v5.13.0:opencode:aidd-context:${sha}`);
    expect(next.source).toEqual(source);
    expect(await fs.readFile("/home/user/.config/opencode/skills/aidd-context/test/SKILL.md")).toBe(
      content
    );
    expect((await registry.list("/project"))[0]?.source).toEqual({
      kind: "github",
      repo: "ai-driven-dev/framework",
      ref: "v5.12.0",
    });
  });

  it.each(["1.0.0", "2.0.0"])(
    "leaves version %s unchanged when no upgrade exists",
    async (version) => {
      const f = fixture(version);
      expect(await f.updater.update(f.plugin, "cursor", "/A", f.logger)).toBeNull();
      expect(await f.fs.fileExists(join(f.base, "sample-plugin/skills/demo/SKILL.md"))).toBe(false);
      expect(f.plugin.version).toBe(version);
      expect(f.plugin.dependents).toEqual(["/A", "/B"]);
    }
  );

  it("applies a planned upgrade through the public convenience method and preserves dependents", async () => {
    const f = fixture();
    const result = await f.updater.update(f.plugin, "cursor", "/A", f.logger);
    expect(result?.version).toBe("1.0.0");
    expect(result?.scope).toBe("user");
    expect(result?.dependents).toEqual(["/A", "/B"]);
    expect(await f.fs.readFile(join(f.base, "sample-plugin/skills/demo/SKILL.md"))).toBe(f.content);
    expect(result?.files.get("sample-plugin/skills/demo/SKILL.md")).toBe(
      f.hasher.hash(f.content).value
    );
  });

  it("refuses unsafe recorded files with an actionable diagnostic before writes", async () => {
    const f = fixture();
    const unsafe = f.plugin.withFiles(
      new Map([["../foreign.txt", f.hasher.hash("foreign").value]])
    );
    await f.fs.writeFile(join(f.base, "../foreign.txt"), "foreign");
    await expect(f.updater.update(unsafe, "cursor", "/A", f.logger)).rejects.toThrow(
      "cursor: 'sample-plugin' has unsafe recorded files; update refused without dropping its machine claim."
    );
    expect(await f.fs.readFile(join(f.base, "../foreign.txt"))).toBe("foreign");
    expect(await f.fs.fileExists(join(f.base, "sample-plugin/skills/demo/SKILL.md"))).toBe(false);
  });

  it("writes back a recorded file that was deleted", async () => {
    const f = fixture();
    const path = "sample-plugin/skills/demo/SKILL.md";
    const owned = f.plugin.withFiles(new Map([[path, f.hasher.hash(f.content).value]]));

    const result = await f.updater.update(owned, "cursor", "/A", f.logger);

    expect(await f.fs.readFile(join(f.base, path))).toBe(f.content);
    expect(result?.files.has(path)).toBe(true);
    expect(f.logger.warnMessages.filter((m) => m.includes("left in place"))).toEqual([]);
  });

  it("refuses to rebuild global files without the shared source, rather than write a project's layout", async () => {
    const f = fixture();
    await expect(f.updater.update(f.plugin, "opencode", "/A", f.logger)).rejects.toThrow(
      "run `aidd setup --global`"
    );
  });

  it("rechecks planned new-file containment when a parent becomes a symlink", async () => {
    const f = fixture();
    const plan = await f.updater.planUpdate(f.plugin, "cursor", "/A", f.logger);
    if (plan === null) throw new Error("Expected upgrade plan");
    await f.fs.writeFile("/foreign/skills/demo/SKILL.md", "foreign");
    f.fs.setSymlink(join(f.base, "sample-plugin"), "/foreign");
    await expect(f.updater.applyUpdate(plan, f.logger)).rejects.toThrow(
      `cursor: 'sample-plugin' directory is not safely inside ${f.base}; update refused.`
    );
    expect(await f.fs.readFile("/foreign/skills/demo/SKILL.md")).toBe("foreign");
  });
});

describe("Kilo user-scope TUI registration", () => {
  async function kiloFixture() {
    const fs = new InMemoryFileAdapter();
    const hasher = new DeterministicHasher();
    const logger = new CapturingLogger();
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      "/project",
      Marketplace.create({
        name: "aidd-framework",
        source: { kind: "local", path: "/source" },
        scope: "user",
        addedAt: "2026-01-01",
      })
    );
    fs.setFile("/built/kilo/.kilo/hooks/aidd-maintenance/kilo-tui.js", "export default {};");
    fs.setFile("/home/user/.config/kilo/tui.jsonc", '{\n  // keep\n  "plugin": ["other"]\n}\n');
    const dist = new PluginDistribution({
      manifest: { name: "aidd-maintenance", version: "1.0.0" },
      format: "claude",
      files: [],
      components: { commands: [], agents: [], rules: [], skills: [], hooks: [], mcp: [] },
    });
    const updater = new UserPluginFileUpdater(
      fs,
      new PluginDistributionLoader(new FixturePluginFetcher(), { read: async () => dist }),
      hasher,
      {
        ensureBuilt: fakeEnsureBuiltMarketplace(),
        marketplaceRegistry: registry,
        homedir: () => "/home/user",
      }
    );
    const plugin = InstalledPlugin.fromMetadata(
      "aidd-maintenance",
      "0.1.0",
      { kind: "local", path: "/source" },
      false,
      "user",
      "aidd-framework"
    );
    return { fs, updater, plugin, logger };
  }

  it("registers the built TUI module, preserves existing configuration and records ownership", async () => {
    const f = await kiloFixture();
    const installed = await f.updater.update(f.plugin, "kilo", "/project", f.logger);
    const config = await f.fs.readFile("/home/user/.config/kilo/tui.jsonc");
    expect(config).toContain("// keep");
    expect(config).toContain('"other"');
    expect(config).toContain("./hooks/aidd-maintenance/kilo-tui.js");
    expect(installed?.tuiPlugin?.config).toBe("tui.jsonc");
    expect(await f.fs.readFile("/home/user/.config/kilo/hooks/aidd-maintenance/kilo-tui.js")).toBe(
      "export default {};"
    );
  });

  it("refuses an unowned TUI entry before touching plugin files", async () => {
    const f = await kiloFixture();
    f.fs.setFile(
      "/home/user/.config/kilo/tui.jsonc",
      '{"plugin":["./hooks/aidd-maintenance/kilo-tui.js"]}'
    );
    await expect(f.updater.update(f.plugin, "kilo", "/project", f.logger)).rejects.toThrow(
      /without ownership/
    );
    expect(
      await f.fs.fileExists("/home/user/.config/kilo/hooks/aidd-maintenance/kilo-tui.js")
    ).toBe(false);
  });

  it("rechecks the TUI config after planning and refuses before writing plugin files", async () => {
    const f = await kiloFixture();
    const plan = await f.updater.planUpdate(f.plugin, "kilo", "/project", f.logger);
    if (plan === null) throw new Error("expected update plan");
    const changed = '{"plugin":["./hooks/aidd-maintenance/kilo-tui.js"]}';
    f.fs.setFile("/home/user/.config/kilo/tui.jsonc", changed);
    await expect(f.updater.applyUpdate(plan, f.logger)).rejects.toThrow(/without ownership/);
    expect(await f.fs.readFile("/home/user/.config/kilo/tui.jsonc")).toBe(changed);
    expect(
      await f.fs.fileExists("/home/user/.config/kilo/hooks/aidd-maintenance/kilo-tui.js")
    ).toBe(false);
  });

  it("refuses when the TUI config switches files after planning", async () => {
    const f = await kiloFixture();
    const plan = await f.updater.planUpdate(f.plugin, "kilo", "/project", f.logger);
    if (plan === null) throw new Error("expected update plan");
    await f.fs.deleteFile("/home/user/.config/kilo/tui.jsonc");
    f.fs.setFile("/home/user/.config/kilo/tui.json", '{"plugin":["other"]}');
    await expect(f.updater.applyUpdate(plan, f.logger)).rejects.toThrow(/configuration changed/);
    expect(
      await f.fs.fileExists("/home/user/.config/kilo/hooks/aidd-maintenance/kilo-tui.js")
    ).toBe(false);
    expect(await f.fs.readFile("/home/user/.config/kilo/tui.json")).toBe('{"plugin":["other"]}');
  });
});
