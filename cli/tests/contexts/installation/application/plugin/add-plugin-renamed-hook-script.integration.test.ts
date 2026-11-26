import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../../../shared/testing/installation-deps.builder.js";
import { loadDistributionOf } from "../../../../shared/testing/load-distribution.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { buildAddPlugin } from "../../testing/build-add-plugin.builder.js";
import { fakeBuildSources } from "../../testing/fake-build-sources.fake.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.fake.js";

const PROJECT_ROOT = "/test-project";
const PLUGIN_DIR = "/plugins/memory-plugin";

/** A plugin shipping one hook script under the name given. */
function shipScript(fs: { setFile(path: string, content: string): void }, script: string): void {
  fs.setFile(
    join(PLUGIN_DIR, ".claude-plugin/plugin.json"),
    JSON.stringify({ name: "memory-plugin", version: "1.0.0" })
  );
  fs.setFile(join(PLUGIN_DIR, "skills/demo/SKILL.md"), "# Demo");
  fs.setFile(join(PLUGIN_DIR, `hooks/${script}`), `${script} body`);
  fs.setFile(
    join(PLUGIN_DIR, "hooks/hooks.json"),
    JSON.stringify({
      hooks: {
        SessionStart: [
          { hooks: [{ type: "command", command: `node \${CLAUDE_PLUGIN_ROOT}/hooks/${script}` }] },
        ],
      },
    })
  );
}

describe("replacing a plugin whose hook script was renamed", () => {
  it("leaves no copy of the old script on a tool that places files flat", async () => {
    const tool = TOOL.opencode;
    const deps = await buildInstallationDeps({ tools: registeredTools() });
    await initAndInstall(deps, PROJECT_ROOT, tool);
    const useCase = buildAddPlugin(
      { fs: deps.fs, logger: new CapturingLogger() },
      { project: deps.manifestRepo, user: deps.userManifestRepo },
      {
        loadDistribution: loadDistributionOf(deps.pluginFetcher, deps.pluginDistributionReader),
        marketplaceRegistry: new FakeMarketplaceRegistry(),
        ...fakeBuildSources(),
      },
      registeredTools()
    );
    const add = (replace?: boolean) =>
      useCase.execute({
        githubMarketplace: false,
        source: { kind: "local", path: PLUGIN_DIR },
        toolIds: [tool],
        projectRoot: PROJECT_ROOT,
        interactive: false,
        replace,
      });
    shipScript(deps.fs, "update_memory.js");
    await add();
    shipScript(deps.fs, "memory.cjs");
    await deps.fs.deleteFile(join(PLUGIN_DIR, "hooks/update_memory.js"));

    await add(true);

    const installed = deps.fs.listAll().filter((p) => p.startsWith(`${PROJECT_ROOT}/`));
    expect(installed.filter((p) => p.endsWith("update_memory.js"))).toEqual([]);
    expect(installed.some((p) => p.endsWith("memory.cjs"))).toBe(true);
  });
});
