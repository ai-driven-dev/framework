import { describe, expect, it, vi } from "vitest";
import { AssertProjectHooksRemovable } from "../../../../../src/contexts/installation/application/shared/assert-project-hooks-removable.use-case.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import {
  aCursorHooksPlugin,
  PLUGIN,
  PROJECT_ROOT,
} from "../../testing/project-hooks-removal.builder.js";

describe("proving a plugin's project hooks removable", () => {
  it("asks for the hooks the plugin recorded, under its own name and the given guard", async () => {
    const unchanged = { execute: vi.fn(async () => ({ existing: null })) };
    const plugin = aCursorHooksPlugin({ entry: true });
    const tool = registeredTools().aiProfile(TOOL.cursor);

    await new AssertProjectHooksRemovable(unchanged).execute({
      plugin,
      tool,
      projectRoot: PROJECT_ROOT,
      guard: { overwriteEdited: true },
    });

    expect(unchanged.execute).toHaveBeenCalledWith({
      pluginName: PLUGIN,
      provenance: plugin.provenance.projectHooks,
      tool,
      projectRoot: PROJECT_ROOT,
      guard: { overwriteEdited: true },
    });
  });
});
