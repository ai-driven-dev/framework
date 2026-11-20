/** A hook a native tool delivers is not a skip but a component with a precondition: Codex
 * gates every hook behind a per-hook trust grant it can decline in silence. */

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PluginDistributionLoader } from "../../../../../src/contexts/installation/application/plugin/plugin-distribution-loader.js";
import type { AiToolId } from "../../../../../src/shared/domain/tool.js";
import { fakeBuildSources } from "../../../../helpers/ports/fake-build-sources.js";
import { seedFromDirectory } from "../../../../helpers/ports/seed-from-directory.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.js";
import { nativeOf } from "../../../../shared/testing/native-plugin-answers.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.js";
import { buildAddPlugin } from "../../testing/build-add-plugin.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.js";
import { buildInstallationDeps, initAndInstall } from "../../testing/installation-deps.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const PROJECT_ROOT = "/test-project";

async function installWithLogger(toolId: AiToolId) {
  const deps = await buildInstallationDeps();
  await initAndInstall(deps, PROJECT_ROOT, toolId);
  await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
  const logger = new CapturingLogger();
  const useCase = buildAddPlugin(
    { fs: deps.fs, logger: logger },
    { project: deps.manifestRepo, user: deps.userManifestRepo },
    {
      distributionLoader: new PluginDistributionLoader(
        deps.pluginFetcher,
        deps.pluginDistributionReader
      ),
      marketplaceRegistry: new FakeMarketplaceRegistry(),
      ...fakeBuildSources(),
    },
    registeredTools()
  );
  await useCase.execute({
    githubMarketplace: false,
    source: { kind: "local", path: PLUGIN_FIXTURE },
    toolIds: [toolId],
    projectRoot: PROJECT_ROOT,
    interactive: false,
  });
  return logger;
}

describe("AddPlugin hook trust notice", () => {
  it("names what Codex still requires, on the info channel, when the plugin delivers hooks", async () => {
    const logger = await installWithLogger(TOOL.codex);

    expect(logger.infoMessages).toHaveLength(1);
    expect(logger.infoMessages[0]).toBe(
      `Plugin "sample-plugin" (codex): ${nativeOf(registeredTools().aiProfile(TOOL.codex).plugins()).trustNotice()}`
    );
    expect(logger.warnMessages).toEqual([]);
  });

  it("says nothing for a tool with no trust gate on its hooks", async () => {
    const logger = await installWithLogger(TOOL.claude);

    expect(logger.infoMessages).toEqual([]);
  });
});
