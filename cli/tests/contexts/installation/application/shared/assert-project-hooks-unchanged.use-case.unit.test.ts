import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { projectIntegrationOver } from "../../../../shared/testing/project-integration.builder.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const { cursor } = TOOL;

const PROJECT_ROOT = "/test-project";
const PLUGIN = "aidd-context";
const OTHER = "aidd-dev";
const HOOKS_PATH = join(PROJECT_ROOT, ".cursor", "hooks.json");

function hooksFile(...plugins: string[]): string {
  return JSON.stringify({
    version: 1,
    hooks: { preToolUse: plugins.map((p) => ({ command: `node ./.cursor/hooks/${p}/pre.js` })) },
  });
}

describe("before changing a project's hooks", () => {
  it("allows a legacy install with no project contribution and returns the existing hooks during preflight", async () => {
    const content = hooksFile(OTHER);
    const fs = new InMemoryFileAdapter({ [HOOKS_PATH]: content });

    await expect(
      projectIntegrationOver(fs).unchanged.execute({
        pluginName: PLUGIN,
        provenance: undefined,
        tool: registeredTools().aiProfile(cursor),
        projectRoot: PROJECT_ROOT,
      })
    ).resolves.toStrictEqual({ existing: content });
    await expect(
      projectIntegrationOver(fs).unchanged.execute({
        pluginName: PLUGIN,
        provenance: undefined,
        tool: registeredTools().aiProfile(TOOL.opencode),
        projectRoot: PROJECT_ROOT,
      })
    ).resolves.toStrictEqual({ existing: null });

    expect(fs.getFile(HOOKS_PATH)).toBe(content);
  });

  it("refuses a legacy install whose hooks are still in the file, with no digest to prove them", async () => {
    const fs = new InMemoryFileAdapter({ [HOOKS_PATH]: hooksFile(PLUGIN) });

    await expect(
      projectIntegrationOver(fs).unchanged.execute({
        pluginName: PLUGIN,
        provenance: undefined,
        tool: registeredTools().aiProfile(cursor),
        projectRoot: PROJECT_ROOT,
      })
    ).rejects.toThrow(/unproven legacy install digest/);
  });
});
