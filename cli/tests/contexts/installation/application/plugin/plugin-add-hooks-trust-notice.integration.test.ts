/** A hook a native tool delivers is not a skip but a component with a precondition: Codex
 * gates every hook behind a per-hook trust grant it can decline in silence. */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AddPlugin } from "../../../../../src/contexts/installation/application/plugin/add-plugin.js";
import { PluginDistributionLoader } from "../../../../../src/contexts/installation/application/plugin/plugin-distribution-loader.js";
import { PluginDistributionReaderAdapter } from "../../../../../src/contexts/installation/infrastructure/plugin-distribution-reader-adapter.js";
import { codex } from "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import type { AiToolId } from "../../../../../src/shared/domain/tool.js";
import { buildUnitDeps, initAndInstall } from "../../../../helpers/ports/build-unit-deps.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { fakeBuildSources } from "../../../../helpers/ports/fake-build-sources.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";
import { seedFromDirectory } from "../../../../helpers/ports/seed-from-directory.js";
import { nativeOf } from "../../../../shared/testing/native-plugin-answers.js";
import { catalogOf, TOOL } from "../../../tools/testing/catalog-of.js";
import { registeredManifestProbes } from "../../../translate/testing/registered-manifest-probes.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const PROJECT_ROOT = "/test-project";

async function installWithLogger(toolId: AiToolId) {
  const deps = await buildUnitDeps(PROJECT_ROOT);
  await initAndInstall(deps, PROJECT_ROOT, toolId);
  await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
  const logger = new CapturingLogger();
  const useCase = new AddPlugin(
    { fs: deps.fs, hasher: deps.hasher, logger: logger },
    { project: deps.manifestRepo, user: deps.userManifestRepo },
    {
      distributionLoader: new PluginDistributionLoader(
        deps.pluginFetcher,
        new PluginDistributionReaderAdapter(deps.fs, registeredManifestProbes())
      ),
      marketplaceRegistry: new InMemoryMarketplaceRegistry(),
      ...fakeBuildSources(),
    }
  );
  await useCase.execute({
    tools: catalogOf(),
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
      `Plugin "sample-plugin" (codex): ${nativeOf(codex.plugins()).trustNotice()}`
    );
    expect(logger.warnMessages).toEqual([]);
  });

  it("says nothing for a tool with no trust gate on its hooks", async () => {
    const logger = await installWithLogger(TOOL.claude);

    expect(logger.infoMessages).toEqual([]);
  });
});
