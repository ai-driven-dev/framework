import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { placePluginOf } from "../../../../../../src/composition/orchestration/built-placement.js";
import { ResolveAddedPluginSource } from "../../../../../../src/contexts/installation/application/plugin/add/resolve-added-plugin-source.use-case.js";
import { Manifest } from "../../../../../../src/contexts/installation/domain/manifest.js";
import { CapturingLogger } from "../../../../../shared/testing/capturing-logger.fake.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../../../../shared/testing/installation-deps.builder.js";
import { loadDistributionOf } from "../../../../../shared/testing/load-distribution.builder.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../../../shared/testing/seed-from-directory.builder.js";
import { fakeBuiltDeps } from "../../../testing/fake-build-sources.fake.js";
import { FakeMarketplaceRegistry } from "../../../testing/fake-marketplace-registry.fake.js";

const { cursor } = TOOL;
const PROJECT_ROOT = "/test-project";
const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const GIT_SUBDIR_SOURCE = {
  kind: "git-subdir" as const,
  url: "https://github.com/ai-driven-dev/framework.git",
  path: "plugins/sample-plugin",
};
const CURSOR_SKILL = "sample-plugin/skills/demo/SKILL.md";
const FOUND_DIR = join(homedir(), ".cursor/plugins/local", "sample-plugin");

async function placeForCursor(foundFile: string | undefined) {
  const deps = await buildInstallationDeps({ tools: registeredTools() });
  await initAndInstall(deps, PROJECT_ROOT, cursor);
  await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
  deps.pluginFetcher.register(GIT_SUBDIR_SOURCE, PLUGIN_FIXTURE);
  deps.fs.setFile(`/built/cursor/plugins/${CURSOR_SKILL}`, "# Demo skill");
  if (foundFile !== undefined) deps.fs.setFile(join(FOUND_DIR, "skills/demo/SKILL.md"), foundFile);
  const registry = new FakeMarketplaceRegistry();
  registry.seed(PROJECT_ROOT, {
    name: "aidd-framework",
    source: { kind: "github", repo: "ai-driven-dev/framework" },
    scope: "project",
  });
  const built = fakeBuiltDeps(deps.fs, { marketplaceRegistry: registry, homedir });
  const added = await new ResolveAddedPluginSource(
    {
      loadDistribution: loadDistributionOf(deps.pluginFetcher, deps.pluginDistributionReader),
    },
    registeredTools()
  ).execute({
    source: GIT_SUBDIR_SOURCE,
    projectRoot: PROJECT_ROOT,
    toolIds: [cursor],
    githubMarketplace: false,
  });
  if (added.isGithubMarketplace) throw new Error("a local add reads its distribution");
  const logger = new CapturingLogger();
  const manifest = await deps.manifestRepo.load();
  if (manifest === null) throw new Error("the project manifest was not initialised");
  await placePluginOf({ fs: deps.fs, logger, built }, registeredTools()).execute({
    dist: added.distribution,
    toolIds: [cursor],
    source: GIT_SUBDIR_SOURCE,
    projectRoot: PROJECT_ROOT,
    manifest,
    machine: Manifest.create(),
    marketplace: "aidd-framework",
    previousMcpEntries: new Map(),
    previousProjectHooks: new Map(),
  });
  return { deps, logger, manifest };
}

describe("placing a plugin on disk", () => {
  it("leaves a user-scope plugin dir it finds already there as it was, warns of it and tracks none of it", async () => {
    const { deps, logger, manifest } = await placeForCursor("# Their own skill");

    expect(deps.fs.getFile(join(FOUND_DIR, "skills/demo/SKILL.md"))).toBe("# Their own skill");
    expect(manifest.getPlugins(cursor).find((p) => p.name === "sample-plugin")?.files.size).toBe(0);
    expect(logger.warnMessages.join("\n")).toContain(FOUND_DIR);
  });
});
