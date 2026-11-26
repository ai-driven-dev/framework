import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { AssertProjectIntegrationRemovable } from "../../../../../src/contexts/installation/application/removal/assert-project-integration-removable.use-case.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
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
  it("asks the MCP entries and the hooks about the same removal", async () => {
    const mcp = { execute: vi.fn(async () => undefined) };
    const hooks = { execute: vi.fn(async () => undefined) };
    const withinRoot = { execute: vi.fn(async () => undefined) };

    await new AssertProjectIntegrationRemovable(mcp, hooks, withinRoot).execute(removal);

    expect(mcp.execute).toHaveBeenCalledWith(removal);
    expect(hooks.execute).toHaveBeenCalledWith(removal);
    expect(withinRoot.execute).not.toHaveBeenCalled();
  });

  it("proves AGENTS.md sits inside the project for a tool that lists its rules there", async () => {
    const kimi = { ...removal, tool: registeredTools().aiProfile(TOOL.kimi) };
    const withinRoot = { execute: vi.fn(async () => undefined) };
    const done = { execute: vi.fn(async () => undefined) };

    await new AssertProjectIntegrationRemovable(done, done, withinRoot).execute(kimi);

    expect(withinRoot.execute).toHaveBeenCalledWith(MCP_ROOT, join(MCP_ROOT, "AGENTS.md"));
  });

  it("refuses on the listed rules before a removal can touch the hooks", async () => {
    const mcp = { execute: vi.fn(async () => undefined) };
    const hooks = { execute: vi.fn(async () => undefined) };
    const withinRoot = {
      execute: vi.fn(async () => {
        throw new Error("agents outside");
      }),
    };

    const kimi = { ...removal, tool: registeredTools().aiProfile(TOOL.kimi) };

    await expect(
      new AssertProjectIntegrationRemovable(mcp, hooks, withinRoot).execute(kimi)
    ).rejects.toThrow("agents outside");
  });

  it("stops at the MCP refusal before it asks the hooks", async () => {
    const mcp = {
      execute: vi.fn(async () => {
        throw new Error("mcp edited");
      }),
    };
    const hooks = { execute: vi.fn(async () => undefined) };
    const withinRoot = { execute: vi.fn(async () => undefined) };

    await expect(
      new AssertProjectIntegrationRemovable(mcp, hooks, withinRoot).execute(removal)
    ).rejects.toThrow("mcp edited");
    expect(hooks.execute).not.toHaveBeenCalled();
  });
});
