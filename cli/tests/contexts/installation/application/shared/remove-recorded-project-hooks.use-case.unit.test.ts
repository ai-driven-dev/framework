import { describe, expect, it } from "vitest";
import { projectIntegrationOf } from "../../../../../src/composition/contexts/installation.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import {
  aCursorHooksPlugin,
  HOOKS_PATH,
  hooksFile,
  OTHER,
  PLUGIN,
  PROJECT_ROOT,
  SCRIPT_PATH,
} from "../../testing/project-hooks-removal.builder.js";

const tool = registeredTools().aiProfile(TOOL.cursor);

function request(script?: string) {
  const plugin = aCursorHooksPlugin({ entry: true, script });
  return {
    pluginName: PLUGIN,
    provenance: plugin.provenance.projectHooks,
    tool,
    projectRoot: PROJECT_ROOT,
  };
}

describe("removing the hooks a plugin recorded", () => {
  it("unmerges its entry and deletes its script, keeping another plugin's entry", async () => {
    const fs = new InMemoryFileAdapter({
      [HOOKS_PATH]: hooksFile(PLUGIN, OTHER),
      [SCRIPT_PATH]: "installed script",
    });

    const removed = await projectIntegrationOf(fs).removeRecorded.execute(
      request("installed script")
    );

    expect(removed).toBe(true);
    expect(await fs.fileExists(SCRIPT_PATH)).toBe(false);
    expect(JSON.parse(await fs.readFile(HOOKS_PATH)).hooks.preToolUse).toHaveLength(1);
  });

  it("deletes the hooks file once no entry is left in it", async () => {
    const fs = new InMemoryFileAdapter({ [HOOKS_PATH]: hooksFile(PLUGIN) });

    await projectIntegrationOf(fs).removeRecorded.execute(request());

    expect(await fs.fileExists(HOOKS_PATH)).toBe(false);
  });

  it("removes nothing when the plugin contributed nothing", async () => {
    const fs = new InMemoryFileAdapter({ [HOOKS_PATH]: hooksFile(OTHER) });
    const plugin = aCursorHooksPlugin();

    const removed = await projectIntegrationOf(fs).removeRecorded.execute({
      pluginName: PLUGIN,
      provenance: plugin.provenance.projectHooks,
      tool,
      projectRoot: PROJECT_ROOT,
    });

    expect(removed).toBe(false);
    expect(await fs.readFile(HOOKS_PATH)).toBe(hooksFile(OTHER));
  });
});
