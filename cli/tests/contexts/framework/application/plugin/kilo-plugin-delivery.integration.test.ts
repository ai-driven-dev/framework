import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PluginAddUseCase } from "../../../../../src/contexts/framework/application/plugin/plugin-add-use-case.js";
import { PluginDistributionLoader } from "../../../../../src/contexts/framework/application/plugin/plugin-distribution-loader.js";
import { PluginUpdateUseCase } from "../../../../../src/contexts/framework/application/plugin/plugin-update-use-case.js";
import { SetupToolsUseCase } from "../../../../../src/contexts/framework/application/setup/setup-tools-use-case.js";
import { buildUnitDeps, initProject } from "../../../../helpers/ports/build-unit-deps.js";
import { fakeEnsureBuiltMarketplace } from "../../../../helpers/ports/fake-ensure-built-marketplace.js";
import { seedFromDirectory } from "../../../../helpers/ports/seed-from-directory.js";
import { REPOSITORY_ROOT } from "../../../../helpers/repository-root.js";

const ROOT = "/test-project";
const FIXTURE = join(REPOSITORY_ROOT, "cli/tests/fixtures/plugins/claude-format/sample-plugin");
const HOOK = ".kilo/hooks/sample-plugin/update_memory.js";
const BRIDGE = ".kilo/plugin/sample-plugin-hooks.js";
const USER_CONFIG = `{
  // Keep this comment and the user's formatting.
  "model": "user/model",
  "permission": { "bash": "ask" },
  "mcp": { "user": { "type": "local", "command": ["node", "user.js"] } }
}\n`;

async function existingProject(configPath: string) {
  const deps = await buildUnitDeps(ROOT);
  await initProject(deps, ROOT);
  await deps.fs.writeFile(join(ROOT, configPath), USER_CONFIG);
  const setup = new SetupToolsUseCase(
    deps.manifestRepo,
    deps.installRuntimeConfigUseCase,
    deps.installIdeConfigUseCase
  );
  const setupOptions = {
    projectRoot: ROOT,
    aiTools: ["kilo" as const],
    ideTools: [],
    force: false,
    version: "test",
  };
  await setup.execute(setupOptions);
  await seedFromDirectory(deps.fs, FIXTURE, { useAbsolutePaths: true });
  const distribution = new PluginDistributionLoader(
    deps.pluginFetcher,
    deps.pluginDistributionReader
  );
  const add = new PluginAddUseCase(
    deps.fs,
    deps.manifestRepo,
    distribution,
    deps.hasher,
    deps.logger,
    deps.marketplaceRegistry,
    fakeEnsureBuiltMarketplace(),
    deps.userManifestRepo,
    deps.installRuntimeConfigUseCase
  );
  const install = () =>
    add.execute({
      source: { kind: "local", path: FIXTURE },
      toolIds: ["kilo"],
      projectRoot: ROOT,
      interactive: false,
    });
  const update = new PluginUpdateUseCase(
    deps.fs,
    deps.manifestRepo,
    distribution,
    deps.hasher,
    undefined,
    deps.installRuntimeConfigUseCase
  );
  return { deps, setup, setupOptions, install, update };
}

describe.each(["kilo.jsonc", ".kilo/kilo.jsonc"])(
  "Kilo delivery with a user-owned %s",
  (configPath) => {
    it("keeps the exact JSONC bytes during first and repeated tool setup", async () => {
      const { deps, setup, setupOptions } = await existingProject(configPath);
      expect(await deps.fs.readFile(join(ROOT, configPath))).toBe(USER_CONFIG);
      expect(deps.manifestRepo.getCurrent()?.hasTool("kilo")).toBe(true);
      await setup.execute(setupOptions);
      expect(await deps.fs.readFile(join(ROOT, configPath))).toBe(USER_CONFIG);
      const other = configPath === "kilo.jsonc" ? ".kilo/kilo.jsonc" : "kilo.jsonc";
      expect(await deps.fs.fileExists(join(ROOT, other))).toBe(false);
    });

    it("installs the hook and its generated bridge without changing user configuration", async () => {
      const { deps, install } = await existingProject(configPath);
      await install();
      expect(await deps.fs.readFile(join(ROOT, configPath))).toBe(USER_CONFIG);
      expect(await deps.fs.readFile(join(ROOT, HOOK))).toBe(
        await deps.fs.readFile(join(FIXTURE, "hooks/update_memory.js"))
      );
      expect(await deps.fs.readFile(join(ROOT, BRIDGE))).toContain('id: "sample-plugin-hooks"');
      expect(deps.manifestRepo.getCurrent()?.getPlugins("kilo")[0]?.version).toBe("1.0.0");
    });

    it("updates the hook and bridge while retaining the exact user configuration", async () => {
      const { deps, install, update } = await existingProject(configPath);
      await install();
      const upgradedHook = 'console.log("upgraded memory hook");\n';
      await deps.fs.writeFile(join(FIXTURE, "hooks/update_memory.js"), upgradedHook);
      await deps.fs.writeFile(
        join(FIXTURE, ".claude-plugin/plugin.json"),
        '{"name":"sample-plugin","version":"2.0.0"}'
      );
      await deps.fs.deleteFile(join(ROOT, BRIDGE));
      expect(await update.execute({ toolIds: ["kilo"], projectRoot: ROOT })).toEqual([
        "sample-plugin",
      ]);
      expect(await deps.fs.readFile(join(ROOT, configPath))).toBe(USER_CONFIG);
      expect(await deps.fs.readFile(join(ROOT, HOOK))).toBe(upgradedHook);
      expect(await deps.fs.readFile(join(ROOT, BRIDGE))).toContain('id: "sample-plugin-hooks"');
      expect(deps.manifestRepo.getCurrent()?.getPlugins("kilo")[0]?.version).toBe("2.0.0");
    });
  }
);
