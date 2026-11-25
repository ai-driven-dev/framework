import { describe, expect, it, vi } from "vitest";
import { AssertProjectIntegrationRemovable } from "../../../../../src/contexts/installation/application/removal/assert-project-integration-removable.use-case.js";
import {
  contributedOpencodeConfig,
  MCP_ROOT,
  opencode,
  pluginWithMcp,
} from "../../testing/opencode-mcp-config.builder.js";

const removal = {
  plugin: pluginWithMcp(contributedOpencodeConfig().entries),
  tool: opencode,
  projectRoot: MCP_ROOT,
};

describe("proving a plugin's project integration removable", () => {
  it("asks both the MCP entries and the hooks about the same removal", async () => {
    const mcp = { execute: vi.fn(async () => undefined) };
    const hooks = { execute: vi.fn(async () => undefined) };

    await new AssertProjectIntegrationRemovable(mcp, hooks).execute(removal);

    expect(mcp.execute).toHaveBeenCalledWith(removal);
    expect(hooks.execute).toHaveBeenCalledWith(removal);
  });

  it("stops at the MCP refusal before it asks the hooks", async () => {
    const mcp = {
      execute: vi.fn(async () => {
        throw new Error("mcp edited");
      }),
    };
    const hooks = { execute: vi.fn(async () => undefined) };

    await expect(
      new AssertProjectIntegrationRemovable(mcp, hooks).execute(removal)
    ).rejects.toThrow("mcp edited");
    expect(hooks.execute).not.toHaveBeenCalled();
  });
});
