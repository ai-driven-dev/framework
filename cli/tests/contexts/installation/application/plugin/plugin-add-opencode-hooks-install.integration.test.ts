import { PluginDistributionLoader } from "../../../../../src/contexts/installation/application/plugin/plugin-distribution-loader.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.js";
/** Installing a plugin carrying hooks/ against OpenCode delivers the script, namespaced under
 * .opencode/hooks/<plugin>/ like .claude/ and .cursor/ already are. Never .opencode/plugin/,
 * which OpenCode's own loader imports in-process, where a plain hook script kills the host. */

import { join, posix } from "node:path";
import { describe, expect, it } from "vitest";
import { buildAddPlugin } from "../../../../helpers/ports/build-add-plugin.js";
import { buildUnitDeps, initAndInstall } from "../../../../helpers/ports/build-unit-deps.js";
import { fakeBuildSources } from "../../../../helpers/ports/fake-build-sources.js";
import { seedFromDirectory } from "../../../../helpers/ports/seed-from-directory.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const PROJECT_ROOT = "/test-project";

async function installSamplePlugin() {
  const deps = await buildUnitDeps(PROJECT_ROOT);
  await initAndInstall(deps, PROJECT_ROOT, TOOL.opencode);
  await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
  const capturingLogger = new CapturingLogger();
  const registry = new FakeMarketplaceRegistry();
  const useCase = buildAddPlugin(
    { fs: deps.fs, logger: capturingLogger },
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
  await useCase.execute({
    githubMarketplace: false,
    source: { kind: "local", path: PLUGIN_FIXTURE },
    toolIds: [TOOL.opencode],
    projectRoot: PROJECT_ROOT,
    interactive: false,
  });
  return { deps, capturingLogger };
}

describe("AddPlugin OpenCode hooks install (Phase 7)", () => {
  it("writes every hooks/ script but the manifest under .opencode/hooks/<plugin>/", async () => {
    const { deps } = await installSamplePlugin();

    // deps.fs is the in-memory adapter, whose listUnder() returns "/"-normalised keys whatever the
    // platform joined with, so a native `join` would answer "\\" on win32 and match none of them.
    const writtenPaths = deps.fs.listUnder(PROJECT_ROOT);
    expect(writtenPaths).toContain(
      posix.join(PROJECT_ROOT, ".opencode", "hooks", "sample-plugin", "update_memory.js")
    );
    expect(writtenPaths).not.toContain(
      posix.join(PROJECT_ROOT, ".opencode", "hooks", "sample-plugin", "hooks.json")
    );
    // Never under .opencode/plugin/ either: that is the directory OpenCode's own
    // loader imports in-process, and a plain hook script there kills the host.
    expect(writtenPaths).not.toContain(
      posix.join(PROJECT_ROOT, ".opencode", "plugin", "update_memory.js")
    );
  });

  it("emits no logger.warn — hooks are delivered, not skipped", async () => {
    const { capturingLogger } = await installSamplePlugin();

    expect(capturingLogger.warnMessages).toEqual([]);
  });
});

// `plugin install` and `setup` reach OpenCode through ContentTranslator, never through
// DiskSink, so without flatHooksBridge there the namespaced script triggers nothing.
describe("AddPlugin OpenCode event bridge (Lot B)", () => {
  it("generates .opencode/plugin/<plugin>-hooks.js for a plugin's mapped hook", async () => {
    const { deps } = await installSamplePlugin();

    const writtenPaths = deps.fs.listUnder(PROJECT_ROOT);
    expect(writtenPaths).toContain(
      posix.join(PROJECT_ROOT, ".opencode", "plugin", "sample-plugin-hooks.js")
    );
    expect(writtenPaths).toContain(
      posix.join(PROJECT_ROOT, ".opencode", "hooks", "opencode-events.js")
    );
  });
});
