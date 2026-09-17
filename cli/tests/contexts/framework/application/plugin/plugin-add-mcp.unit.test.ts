import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { PluginAddUseCase } from "../../../../../src/contexts/framework/application/plugin/plugin-add-use-case.js";
import type { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { PluginDistributionReaderAdapter } from "../../../../../src/contexts/framework/infrastructure/plugin-distribution-reader-adapter.js";
import {
  buildUnitDeps,
  initAndInstall,
  installTool,
} from "../../../../helpers/ports/build-unit-deps.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { seedFromDirectory } from "../../../../helpers/ports/seed-from-directory.js";

const EXTRA_PLUGIN_FIXTURE = join(
  process.cwd(),
  "tests/fixtures/plugins/claude-format/extra-plugin"
);
const PROJECT_ROOT = "/test-project";
const MCP_PLUGIN_DIR = "/plugins/mcp-plugin";
const OPENCODE_JSON = join(PROJECT_ROOT, "opencode.json");

type Deps = Awaited<ReturnType<typeof buildUnitDeps>>;

async function buildOpencodeProject(): Promise<{
  deps: Deps;
  logger: CapturingLogger;
  useCase: PluginAddUseCase;
}> {
  const deps = await buildUnitDeps(PROJECT_ROOT);
  await initAndInstall(deps, PROJECT_ROOT, "opencode");
  deps.fs.setFile(
    join(MCP_PLUGIN_DIR, ".claude-plugin/plugin.json"),
    JSON.stringify({ name: "mcp-plugin", version: "1.0.0" })
  );
  deps.fs.setFile(join(MCP_PLUGIN_DIR, "skills/demo/SKILL.md"), "# Demo skill");
  deps.fs.setFile(
    join(MCP_PLUGIN_DIR, ".mcp.json"),
    JSON.stringify({ mcpServers: { "local-tool": { command: "node", args: ["./server.js"] } } })
  );
  const logger = new CapturingLogger();
  const useCase = new PluginAddUseCase(
    deps.fs,
    deps.manifestRepo,
    deps.pluginFetcher,
    new PluginDistributionReaderAdapter(deps.fs),
    deps.hasher,
    logger,
    deps.marketplaceRegistry,
    fakeEnsureBuiltMarketplace(),
    deps.userManifestRepo
  );
  return { deps, logger, useCase };
}

function addLocal(useCase: PluginAddUseCase, path: string, replace?: boolean): Promise<void> {
  return useCase.execute({
    source: { kind: "local", path },
    toolIds: ["opencode"],
    projectRoot: PROJECT_ROOT,
    interactive: false,
    replace,
  });
}

function installedMcpPlugin(deps: Deps): InstalledPlugin | undefined {
  return deps.manifestRepo
    .getCurrent()
    ?.getPlugins("opencode")
    .find((p) => p.name === "mcp-plugin");
}

describe("PluginAddUseCase and opencode MCP servers", () => {
  it("keeps user servers and other config while recording only successfully installed MCP servers", async () => {
    const { deps, logger, useCase } = await buildOpencodeProject();
    const owned = { type: "local", command: ["user-server"], enabled: false };
    deps.fs.setFile(
      OPENCODE_JSON,
      JSON.stringify({ model: "user/model", mcp: { "local-tool": owned } })
    );
    deps.fs.setFile(
      join(MCP_PLUGIN_DIR, ".mcp.json"),
      JSON.stringify({
        mcpServers: {
          "local-tool": { command: "node", args: ["./server.js"] },
          "new-tool": { command: "node", args: ["./new.js"], env: { MODE: "plugin" } },
        },
      })
    );

    await addLocal(useCase, MCP_PLUGIN_DIR);

    const config = JSON.parse(deps.fs.getFile(OPENCODE_JSON) ?? "null");
    expect(config.model).toBe("user/model");
    expect(config.mcp["local-tool"]).toStrictEqual(owned);
    expect(config.mcp["new-tool"]).toStrictEqual({
      type: "local",
      command: ["node", "./new.js"],
      environment: { MODE: "plugin" },
      enabled: true,
    });
    expect([...(installedMcpPlugin(deps)?.mcpEntries.keys() ?? [])]).toStrictEqual(["new-tool"]);
    expect(logger.warnMessages).toStrictEqual([
      'Plugin "mcp-plugin": mcp skipped for opencode — local-tool: server already exists in opencode.json (user-owned); plugin entry skipped',
    ]);
  });

  it("uses the selected Cursor plugin's hook provenance when another hook plugin was installed first", async () => {
    const { deps, useCase } = await buildOpencodeProject();
    await installTool(deps, PROJECT_ROOT, "cursor");
    const otherDir = "/plugins/other-hook-plugin";
    for (const [name, dir] of [
      ["other-hook-plugin", otherDir],
      ["mcp-plugin", MCP_PLUGIN_DIR],
    ]) {
      deps.fs.setFile(
        join(dir, ".claude-plugin/plugin.json"),
        JSON.stringify({ name, version: "1.0.0" })
      );
      deps.fs.setFile(join(dir, "skills/demo/SKILL.md"), "# Demo");
      deps.fs.setFile(join(dir, "hooks/pre.js"), `${name} original script`);
      deps.fs.setFile(
        join(dir, "hooks/hooks.json"),
        JSON.stringify({
          hooks: {
            PreToolUse: [
              { hooks: [{ type: "command", command: `node \${CLAUDE_PLUGIN_ROOT}/hooks/pre.js` }] },
            ],
          },
        })
      );
      await useCase.execute({
        source: { kind: "local", path: dir },
        toolIds: ["cursor"],
        projectRoot: PROJECT_ROOT,
        interactive: false,
      });
    }
    const otherBefore = deps.manifestRepo
      .getCurrent()
      ?.getPlugins("cursor")
      .find((p) => p.name === "other-hook-plugin")
      ?.toJSON();
    deps.fs.setFile(join(MCP_PLUGIN_DIR, "hooks/pre.js"), "mcp-plugin updated script");

    await useCase.execute({
      source: { kind: "local", path: MCP_PLUGIN_DIR },
      toolIds: ["cursor"],
      projectRoot: PROJECT_ROOT,
      interactive: false,
      replace: true,
    });

    const hooks = JSON.parse(deps.fs.getFile(join(PROJECT_ROOT, ".cursor/hooks.json")) ?? "null");
    expect(hooks.hooks.preToolUse.map((hook: { command: string }) => hook.command)).toStrictEqual([
      "node ./.cursor/hooks/other-hook-plugin/pre.js",
      "node ./.cursor/hooks/mcp-plugin/pre.js",
    ]);
    expect(deps.fs.getFile(join(PROJECT_ROOT, ".cursor/hooks/mcp-plugin/pre.js"))).toBe(
      "mcp-plugin updated script"
    );
    expect(deps.fs.getFile(join(PROJECT_ROOT, ".cursor/hooks/other-hook-plugin/pre.js"))).toBe(
      "other-hook-plugin original script"
    );
    expect(
      deps.manifestRepo
        .getCurrent()
        ?.getPlugins("cursor")
        .find((p) => p.name === "other-hook-plugin")
        ?.toJSON()
    ).toStrictEqual(otherBefore);
    expect(
      deps.manifestRepo
        .getCurrent()
        ?.getPlugins("cursor")
        .find((p) => p.name === "mcp-plugin")?.projectHooks?.scripts.size
    ).toBe(1);
  });

  it.each([undefined, "local-marketplace"])(
    "explains hook trust after a Codex install via %s",
    async (marketplace) => {
      const { deps, logger, useCase } = await buildOpencodeProject();
      await installTool(deps, PROJECT_ROOT, "codex");
      deps.fs.setFile(join(MCP_PLUGIN_DIR, "hooks/pre.js"), "console.log('hook');");
      deps.fs.setFile(
        join(MCP_PLUGIN_DIR, "hooks/hooks.json"),
        JSON.stringify({
          hooks: {
            PreToolUse: [
              { hooks: [{ type: "command", command: `node \${CLAUDE_PLUGIN_ROOT}/hooks/pre.js` }] },
            ],
          },
        })
      );

      await useCase.execute({
        source: { kind: "local", path: MCP_PLUGIN_DIR },
        toolIds: ["codex"],
        projectRoot: PROJECT_ROOT,
        interactive: false,
        marketplace,
      });

      expect(logger.infoMessages).toStrictEqual([
        'Plugin "mcp-plugin" (codex): Codex will not run this plugin\'s hooks until each one is trusted — approve the prompt once in an interactive session, or pass --dangerously-bypass-hook-trust to codex exec for a headless run. Until then, a session leaves no run journal and nothing says why.',
      ]);
      expect(logger.warnMessages).toStrictEqual([]);
      const installed = deps.manifestRepo
        .getCurrent()
        ?.getPlugins("codex")
        .find((p) => p.name === "mcp-plugin");
      expect(installed).toBeDefined();
      expect(installed?.marketplace).toBe(marketplace);
      if (marketplace === undefined) {
        expect(deps.fs.getFile(join(PROJECT_ROOT, ".codex/plugins/mcp-plugin/hooks/pre.js"))).toBe(
          "console.log('hook');"
        );
        expect(installed?.files.size).toBeGreaterThan(0);
      } else {
        expect(installed?.files.size).toBe(0);
      }
    }
  );

  it.each(["local", "github marketplace"] as const)(
    "refuses %s replacement of an edited MCP contribution before saving or rewriting files",
    async (route) => {
      const { deps, useCase } = await buildOpencodeProject();
      await seedFromDirectory(deps.fs, EXTRA_PLUGIN_FIXTURE, { useAbsolutePaths: true });
      await addLocal(useCase, EXTRA_PLUGIN_FIXTURE);
      await addLocal(useCase, MCP_PLUGIN_DIR);
      const installed = installedMcpPlugin(deps);
      if (installed === undefined) throw new Error("fixture missing MCP plugin");
      const filesBefore = new Map(
        [...installed.files.keys()].map((path) => [path, deps.fs.getFile(join(PROJECT_ROOT, path))])
      );
      const manifestBefore = deps.manifestRepo.getCurrent()?.toJSON();
      const savesBefore = deps.manifestRepo.saveCount;
      const userConfig = JSON.stringify({
        mcp: { "local-tool": { type: "local", command: ["user-custom-command"] } },
      });
      deps.fs.setFile(OPENCODE_JSON, userConfig);
      if (route === "github marketplace")
        await deps.marketplaceRegistry.save(
          PROJECT_ROOT,
          Marketplace.create({
            name: "aidd-framework",
            source: { kind: "github", repo: "ai-driven-dev/framework" },
            scope: "project",
            addedAt: "2026-05-01T00:00:00.000Z",
          })
        );

      await expect(
        useCase.execute({
          source: { kind: "local", path: MCP_PLUGIN_DIR },
          toolIds: ["opencode"],
          projectRoot: PROJECT_ROOT,
          interactive: false,
          replace: true,
          ...(route === "github marketplace"
            ? {
                marketplace: "aidd-framework",
                pluginMetadata: { name: "mcp-plugin", version: "1.0.0", strict: false },
              }
            : {}),
        })
      ).rejects.toThrow(/edited/);

      expect(deps.fs.getFile(OPENCODE_JSON)).toBe(userConfig);
      expect(deps.manifestRepo.saveCount).toBe(savesBefore);
      expect(deps.manifestRepo.getCurrent()?.toJSON()).toEqual(manifestBefore);
      for (const [path, content] of filesBefore)
        expect(deps.fs.getFile(join(PROJECT_ROOT, path))).toBe(content);
    }
  );

  it("replaces only the selected plugin while leaving another plugin's user-edited MCP entry untouched", async () => {
    const { deps, useCase } = await buildOpencodeProject();
    await addLocal(useCase, MCP_PLUGIN_DIR);
    const otherDir = "/plugins/other-mcp-plugin";
    deps.fs.setFile(
      join(otherDir, ".claude-plugin/plugin.json"),
      JSON.stringify({
        name: "other-mcp-plugin",
        version: "1.0.0",
      })
    );
    deps.fs.setFile(join(otherDir, "skills/other/SKILL.md"), "# Other skill");
    deps.fs.setFile(
      join(otherDir, ".mcp.json"),
      JSON.stringify({
        mcpServers: { "other-tool": { command: "node", args: ["./other.js"] } },
      })
    );
    await addLocal(useCase, otherDir);
    const current = JSON.parse(deps.fs.getFile(OPENCODE_JSON) ?? "null");
    const edited = { type: "local", command: ["user-other-command"] };
    current.mcp["other-tool"] = edited;
    deps.fs.setFile(OPENCODE_JSON, JSON.stringify(current));
    const otherBefore = deps.manifestRepo
      .getCurrent()
      ?.getPlugins("opencode")
      .find((plugin) => plugin.name === "other-mcp-plugin");

    await addLocal(useCase, MCP_PLUGIN_DIR, true);

    const after = JSON.parse(deps.fs.getFile(OPENCODE_JSON) ?? "null");
    expect(after.mcp["other-tool"]).toEqual(edited);
    expect(after.mcp["local-tool"]).toEqual(current.mcp["local-tool"]);
    expect(
      deps.manifestRepo
        .getCurrent()
        ?.getPlugins("opencode")
        .find((plugin) => plugin.name === "other-mcp-plugin")
    ).toEqual(otherBefore);
    expect(installedMcpPlugin(deps)?.mcpEntries.size).toBe(1);
  });

  it("keeps its own MCP server, without a collision, when re-added with replace", async () => {
    const { deps, logger, useCase } = await buildOpencodeProject();
    await seedFromDirectory(deps.fs, EXTRA_PLUGIN_FIXTURE, { useAbsolutePaths: true });
    await addLocal(useCase, EXTRA_PLUGIN_FIXTURE);
    await addLocal(useCase, MCP_PLUGIN_DIR);
    const firstEntries = [...(installedMcpPlugin(deps)?.mcpEntries ?? [])];

    await addLocal(useCase, MCP_PLUGIN_DIR, true);

    expect(firstEntries.map(([name]) => name)).toStrictEqual(["local-tool"]);
    expect([...(installedMcpPlugin(deps)?.mcpEntries ?? [])]).toStrictEqual(firstEntries);
    expect(logger.warnMessages).toStrictEqual([]);
  });

  it("warns for an MCP server the user already owns and records no entry for it", async () => {
    const { deps, logger, useCase } = await buildOpencodeProject();
    deps.fs.setFile(
      OPENCODE_JSON,
      JSON.stringify({ mcp: { "local-tool": { type: "local", command: ["mine"] } } })
    );

    await addLocal(useCase, MCP_PLUGIN_DIR);

    expect(logger.warnMessages).toStrictEqual([
      'Plugin "mcp-plugin": mcp skipped for opencode — local-tool: server already exists in opencode.json (user-owned); plugin entry skipped',
    ]);
    expect([...(installedMcpPlugin(deps)?.mcpEntries ?? [])]).toStrictEqual([]);
  });
});
