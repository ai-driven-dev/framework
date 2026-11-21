import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PluginDistributionLoader } from "../../../../../src/contexts/installation/application/plugin/plugin-distribution-loader.js";
import { DuplicatePluginError } from "../../../../../src/contexts/installation/domain/installation.error.js";
import type { AiToolId } from "../../../../../src/shared/domain/tool.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../../../shared/testing/installation-deps.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../../shared/testing/seed-from-directory.builder.js";
import { buildAddPlugin } from "../../testing/build-add-plugin.builder.js";
import { fakeBuildSources } from "../../testing/fake-build-sources.fake.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.fake.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const PROJECT_ROOT = "/test-project";
const SOURCE = {
  kind: "git-subdir" as const,
  url: "https://github.com/ai-driven-dev/framework.git",
  path: "plugins/sample-plugin",
};

async function addedOnceWithTheFetchDown(
  tool: AiToolId,
  builtSkill: string,
  version: string | undefined
) {
  const deps = await buildInstallationDeps();
  await initAndInstall(deps, PROJECT_ROOT, tool);
  deps.fs.setFile(builtSkill, "# Demo");
  await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
  deps.pluginFetcher.register(SOURCE, PLUGIN_FIXTURE);
  const registry = new FakeMarketplaceRegistry();
  registry.seed(PROJECT_ROOT, {
    name: "aidd-framework",
    source: { kind: "github", repo: "ai-driven-dev/framework" },
    scope: "project",
  });
  const useCase = buildAddPlugin(
    { fs: deps.fs, logger: deps.logger },
    { project: deps.manifestRepo, user: deps.userManifestRepo },
    {
      distributionLoader: new PluginDistributionLoader(
        deps.pluginFetcher,
        deps.pluginDistributionReader
      ),
      marketplaceRegistry: registry,
      ...fakeBuildSources(),
    },
    registeredTools()
  );
  const add = {
    source: SOURCE,
    toolIds: [tool],
    projectRoot: PROJECT_ROOT,
    marketplace: "aidd-framework",
    githubMarketplace: true,
    interactive: false,
    pluginMetadata: { name: "sample-plugin", version, strict: false },
  };
  await useCase.execute(add);
  vi.spyOn(deps.pluginFetcher, "fetch").mockRejectedValue(new Error("offline"));
  return { deps, useCase, add };
}

describe("AddPlugin from a github marketplace with the fetch down", () => {
  it("refuses a duplicate before reading the distribution of a flat tool", async () => {
    const skill = "/built/opencode/.opencode/skills/sample-plugin/demo/SKILL.md";
    const { useCase, add } = await addedOnceWithTheFetchDown(TOOL.opencode, skill, "1.0.0");

    await expect(useCase.execute(add)).rejects.toThrow(DuplicatePluginError);
  });

  it("refuses a replace over edited project hooks before reading the distribution", async () => {
    const skill = "/built/cursor/plugins/sample-plugin/skills/demo/SKILL.md";
    const { deps, useCase, add } = await addedOnceWithTheFetchDown(TOOL.cursor, skill, "1.0.0");
    const hooks = join(PROJECT_ROOT, ".cursor/hooks.json");
    deps.fs.setFile(hooks, (deps.fs.getFile(hooks) ?? "").replace("update_memory", "edited"));
    const pluginMetadata = { ...add.pluginMetadata, version: undefined };

    await expect(useCase.execute({ ...add, pluginMetadata, replace: true })).rejects.toThrow(
      /edited after install/
    );
  });
});
