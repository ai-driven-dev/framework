import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { InstallTools } from "../../../../../src/contexts/installation/application/install/install-tools.js";
import { ReplacePluginFiles } from "../../../../../src/contexts/installation/application/materialize/replace-plugin-files.js";
import { PluginDistributionLoader } from "../../../../../src/contexts/installation/application/plugin/plugin-distribution-loader.js";
import { UpdatePlugin } from "../../../../../src/contexts/installation/application/plugin/update-plugin.js";
import { REPOSITORY_ROOT } from "../../../../helpers/repository-root.js";
import {
  buildInstallationDeps,
  initProject,
} from "../../../../shared/testing/installation-deps.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../../shared/testing/seed-from-directory.builder.js";
import { buildAddPlugin } from "../../testing/build-add-plugin.builder.js";
import { fakeBuildSources, fakeBuiltDeps } from "../../testing/fake-build-sources.fake.js";

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
  const deps = await buildInstallationDeps();
  await initProject(deps, ROOT);
  await deps.fs.writeFile(join(ROOT, configPath), USER_CONFIG);
  const setup = new InstallTools(
    deps.manifestRepo,
    deps.installRuntimeConfigUseCase,
    deps.installIdeConfig
  );
  const setupOptions = {
    projectRoot: ROOT,
    aiTools: [TOOL.kilo],
    ideTools: [],
    force: false,
    version: "test",
    tools: registeredTools(),
  };
  await setup.execute(setupOptions);
  await seedFromDirectory(deps.fs, FIXTURE, { useAbsolutePaths: true });
  const distribution = new PluginDistributionLoader(
    deps.pluginFetcher,
    deps.pluginDistributionReader
  );
  const add = buildAddPlugin(
    { fs: deps.fs, logger: deps.logger },
    { project: deps.manifestRepo, user: deps.userManifestRepo },
    {
      distributionLoader: distribution,
      marketplaceRegistry: deps.marketplaceRegistry,
      ...fakeBuildSources(),
    },
    registeredTools(),
    deps.installRuntimeConfigUseCase
  );
  const install = () =>
    add.execute({
      githubMarketplace: false,
      source: { kind: "local", path: FIXTURE },
      toolIds: [TOOL.kilo],
      projectRoot: ROOT,
      interactive: false,
    });
  const update = new UpdatePlugin(
    deps.manifestRepo,
    distribution,
    new ReplacePluginFiles(deps.fs, fakeBuiltDeps(), registeredTools()),
    registeredTools(),
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
      expect(deps.manifestRepo.getCurrent()?.hasTool(TOOL.kilo)).toBe(true);
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
      expect(deps.manifestRepo.getCurrent()?.getPlugins(TOOL.kilo)[0]?.version).toBe("1.0.0");
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
      expect(
        await update.execute({
          toolIds: [TOOL.kilo],
          projectRoot: ROOT,
        })
      ).toEqual(["sample-plugin"]);
      expect(await deps.fs.readFile(join(ROOT, configPath))).toBe(USER_CONFIG);
      expect(await deps.fs.readFile(join(ROOT, HOOK))).toBe(upgradedHook);
      expect(await deps.fs.readFile(join(ROOT, BRIDGE))).toContain('id: "sample-plugin-hooks"');
      expect(deps.manifestRepo.getCurrent()?.getPlugins(TOOL.kilo)[0]?.version).toBe("2.0.0");
    });
  }
);
