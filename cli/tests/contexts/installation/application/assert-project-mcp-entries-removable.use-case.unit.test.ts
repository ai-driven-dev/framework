import { describe, expect, it, vi } from "vitest";
import { AssertProjectMcpEntriesRemovable } from "../../../../src/contexts/installation/application/assert-project-mcp-entries-removable.use-case.js";
import {
  contributedOpencodeConfig,
  MCP_ROOT,
  opencode,
  pluginWithMcp,
} from "../testing/opencode-mcp-config.builder.js";

const { entries } = contributedOpencodeConfig();
const removal = { plugin: pluginWithMcp(entries), tool: opencode, projectRoot: MCP_ROOT };

describe("proving a plugin's MCP entries removable", () => {
  it("passes when the removal plan can be drawn", async () => {
    const plan = { execute: vi.fn(async () => undefined) };

    await expect(new AssertProjectMcpEntriesRemovable(plan).execute(removal)).resolves.toBe(
      undefined
    );
    expect(plan.execute).toHaveBeenCalledWith(removal);
  });

  it("refuses with the reason the plan cannot be drawn", async () => {
    const plan = {
      execute: vi.fn(async () => {
        throw new Error("edited");
      }),
    };

    await expect(new AssertProjectMcpEntriesRemovable(plan).execute(removal)).rejects.toThrow(
      "edited"
    );
  });
});
