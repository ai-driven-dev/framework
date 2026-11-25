import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { pluginMaterializerOf } from "../../../../../../src/composition/orchestration/built-placement.js";
import { RecordedPlugin } from "../../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { PLUGIN_CACHE_SUBDIR } from "../../../../../../src/contexts/installation/domain/project-layout.js";
import { FileHash } from "../../../../../../src/shared/domain/file-hash.js";
import type { PathContainment } from "../../../../../../src/shared/domain/paths.model.js";
import { PluginDistribution } from "../../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../../../src/shared/domain/plugin/plugin-name.js";
import { CapturingLogger } from "../../../../../shared/testing/capturing-logger.fake.js";
import { FixturePluginFetcher } from "../../../../../shared/testing/fixture-plugin-fetcher.fake.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { loadDistributionOf } from "../../../../../shared/testing/load-distribution.builder.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { saying } from "../../../../../shared/testing/saying.builder.js";
import { fakeBuiltDeps } from "../../../testing/fake-build-sources.fake.js";
import { userScopeFileGuard } from "../../../testing/user-scope-file-guard.fake.js";

const homedir = (): string => "/home/dev";

/** The machine-claims answer for a path it judges inside the user directory. */
const insideUserScope: PathContainment = () => true;
/** The machine-claims answer for a path it judges outside the user directory. */
const outsideUserScope: PathContainment = () => false;

const { cursor } = TOOL;

function fixture(installedVersion = "0.0.1", options: { globalCacheDir?: () => string } = {}) {
  const fs = new InMemoryFileAdapter();
  const logger = new CapturingLogger();
  const content = "# Updated skill";
  const skill = { relativePath: "skills/demo/SKILL.md", content };
  const dist = new PluginDistribution({
    manifest: { name: parsePluginName("sample-plugin"), version: "1.0.0" },
    format: TOOL.claude,
    files: [skill],
    components: { commands: [], agents: [], rules: [], skills: [skill], hooks: [], mcp: [] },
  });
  const fetcher = {
    fetch: vi.fn(new FixturePluginFetcher().fetch.bind(new FixturePluginFetcher())),
  };
  const updater = pluginMaterializerOf({
    fs,
    loadDistribution: loadDistributionOf(fetcher, { read: async () => dist }),
    guard: userScopeFileGuard,
    builtDeps: { ...fakeBuiltDeps(), homedir },
    globalCacheDir: options.globalCacheDir,
  });
  const plugin = RecordedPlugin.fromMetadata({
    name: "sample-plugin",
    version: installedVersion,
    source: { kind: "local", path: "/source" },
    strict: false,
    scope: "user",
  });
  const base = join(homedir(), ".cursor/plugins/local");
  return { fs, logger, updater, plugin, base, content, fetcher };
}

describe("PluginMaterializer public update contract", () => {
  it.each(["1.0.0", "2.0.0"])(
    "leaves version %s unchanged when no upgrade exists",
    async (version) => {
      const f = fixture(version);
      expect(
        await f.updater.update({
          plugin: f.plugin,
          tool: registeredTools().aiProfile(cursor),
          projectRoot: "/A",
          logger: f.logger,
          isWithinUserScope: insideUserScope,
        })
      ).toBeNull();
      expect(await f.fs.fileExists(join(f.base, "sample-plugin/skills/demo/SKILL.md"))).toBe(false);
      expect(f.plugin.plugin.version).toBe(version);
    }
  );

  it("applies a planned upgrade through the public convenience method and preserves dependents", async () => {
    const f = fixture();
    const result = await f.updater.update({
      plugin: f.plugin,
      tool: registeredTools().aiProfile(cursor),
      projectRoot: "/A",
      logger: f.logger,
      isWithinUserScope: insideUserScope,
    });
    expect(result?.plugin.version).toBe("1.0.0");
    expect(result?.plugin.scope).toBe("user");
    expect(await f.fs.readFile(join(f.base, "sample-plugin/skills/demo/SKILL.md"))).toBe(f.content);
    expect(result?.plugin.files.get("sample-plugin/skills/demo/SKILL.md")).toBe(
      FileHash.of(f.content).value
    );
  });

  it("refuses unsafe recorded files with an actionable diagnostic before writes", async () => {
    const f = fixture();
    const unsafe = f.plugin.withFiles(new Map([["../foreign.txt", FileHash.of("foreign").value]]));
    await f.fs.writeFile(join(f.base, "../foreign.txt"), "foreign");
    await expect(
      f.updater.update({
        plugin: unsafe,
        tool: registeredTools().aiProfile(cursor),
        projectRoot: "/A",
        logger: f.logger,
        isWithinUserScope: insideUserScope,
      })
    ).rejects.toThrow(
      "cursor: 'sample-plugin' has unsafe recorded files; update refused without dropping its machine claim."
    );
    expect(await f.fs.readFile(join(f.base, "../foreign.txt"))).toBe("foreign");
    expect(await f.fs.fileExists(join(f.base, "sample-plugin/skills/demo/SKILL.md"))).toBe(false);
  });

  it("writes back a recorded file that was deleted", async () => {
    const f = fixture();
    const path = "sample-plugin/skills/demo/SKILL.md";
    const owned = f.plugin.withFiles(new Map([[path, FileHash.of(f.content).value]]));

    const result = await f.updater.update({
      plugin: owned,
      tool: registeredTools().aiProfile(cursor),
      projectRoot: "/A",
      logger: f.logger,
      isWithinUserScope: insideUserScope,
    });

    expect(await f.fs.readFile(join(f.base, path))).toBe(f.content);
    expect(result?.plugin.files.has(path)).toBe(true);
    expect(f.logger.warnMessages.filter((m) => m.includes("left in place"))).toEqual([]);
  });

  it("refuses to rebuild global files without the shared source, rather than write a project's layout", async () => {
    const f = fixture();
    await expect(
      f.updater.update({
        plugin: f.plugin,
        tool: registeredTools().aiProfile(TOOL.opencode),
        projectRoot: "/A",
        logger: f.logger,
        isWithinUserScope: insideUserScope,
      })
    ).rejects.toThrow(saying("run `aidd setup --global`"));
  });

  it("rechecks planned new-file containment when a parent becomes a symlink", async () => {
    const f = fixture();
    const plan = await f.updater.planUpdate({
      plugin: f.plugin,
      tool: registeredTools().aiProfile(cursor),
      projectRoot: "/A",
      logger: f.logger,
      rebuild: false,
      isWithinUserScope: insideUserScope,
    });
    if (plan === null) throw new Error("Expected upgrade plan");
    await f.fs.writeFile("/foreign/skills/demo/SKILL.md", "foreign");
    f.fs.setSymlink(join(f.base, "sample-plugin"), "/foreign");
    await expect(
      f.updater.applyUpdate(plan, { logger: f.logger, isWithinUserScope: outsideUserScope })
    ).rejects.toMatchObject({ code: "plugin-directory-outside-boundary" });
    expect(await f.fs.readFile("/foreign/skills/demo/SKILL.md")).toBe("foreign");
  });

  it("refreshes the plugin in the project cache", async () => {
    const f = fixture();
    await f.updater.planUpdate({
      plugin: f.plugin,
      tool: registeredTools().aiProfile(cursor),
      projectRoot: "/A",
      logger: f.logger,
      rebuild: false,
      isWithinUserScope: insideUserScope,
    });
    expect(f.fetcher.fetch).toHaveBeenCalledWith(
      f.plugin.plugin.source,
      join("/A", PLUGIN_CACHE_SUBDIR),
      {
        forceRefresh: true,
      }
    );
  });

  it("refreshes a global install's plugin in the given cache, outside the project", async () => {
    const f = fixture("0.0.1", { globalCacheDir: () => "/config/cache" });
    await f.updater.planUpdate({
      plugin: f.plugin,
      tool: registeredTools().aiProfile(cursor),
      projectRoot: "/A",
      logger: f.logger,
      rebuild: false,
      isWithinUserScope: insideUserScope,
    });
    expect(f.fetcher.fetch).toHaveBeenCalledWith(f.plugin.plugin.source, "/config/cache", {
      forceRefresh: true,
    });
  });
});
