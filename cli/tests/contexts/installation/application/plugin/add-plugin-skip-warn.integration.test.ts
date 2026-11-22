/** Every registered tool now runs what a plugin's `hooks/` ships, so no live fixture reaches
 * `collectHooksSkips`'s non-empty branch; the warn format is pinned tool-agnostically below. */

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ReadonlySkipList } from "../../../../../src/shared/domain/plugin/plugin-translation-skip.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../../../shared/testing/installation-deps.builder.js";
import { loadDistributionOf } from "../../../../shared/testing/load-distribution.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../../shared/testing/seed-from-directory.builder.js";
import { buildAddPlugin } from "../../testing/build-add-plugin.builder.js";
import { fakeBuildSources } from "../../testing/fake-build-sources.fake.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.fake.js";

const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");
const PROJECT_ROOT = "/test-project";

describe("AddPlugin skip warnings", () => {
  describe("when a plugin's hooks are now accepted (no skip entry)", () => {
    it("emits no logger.warn - OpenCode delivers sample-plugin's hooks instead of skipping them", async () => {
      const deps = await buildInstallationDeps({ tools: registeredTools() });
      await initAndInstall(deps, PROJECT_ROOT, TOOL.opencode);
      await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
      const capturingLogger = new CapturingLogger();
      const registry = new FakeMarketplaceRegistry();
      const useCase = buildAddPlugin(
        { fs: deps.fs, logger: capturingLogger },
        { project: deps.manifestRepo, user: deps.userManifestRepo },
        {
          loadDistribution: loadDistributionOf(deps.pluginFetcher, deps.pluginDistributionReader),
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
      expect(capturingLogger.warnMessages).toEqual([]);
    });
  });

  describe("warn message format", () => {
    it("formats skip warnings as Plugin <name>: <component> skipped for <toolId> - <reason>", () => {
      const logger = new CapturingLogger();
      const skipped: ReadonlySkipList = [
        {
          pluginName: "aidd-pm",
          component: "hooks",
          toolId: TOOL.opencode,
          reason: "OpenCode plugin runtime is JS modules; declarative hooks.json is not supported.",
        },
      ];
      for (const entry of skipped) {
        logger.warn(
          `Plugin "${entry.pluginName}": ${entry.component} skipped for ${entry.toolId} — ${entry.reason}`
        );
      }
      expect(logger.warnMessages).toHaveLength(1);
      expect(logger.warnMessages[0]).toBe(
        'Plugin "aidd-pm": hooks skipped for opencode — OpenCode plugin runtime is JS modules; declarative hooks.json is not supported.'
      );
    });
  });
});
