import { describe, expect, it } from "vitest";
import {
  CONFIG_MCP,
  CONFIG_PREFIX,
  MCP_CONFIG_REF,
} from "../../../../src/contexts/tools/contract/config-refs.js";

describe("referring to the mcp config", () => {
  it("names the artifact a tool consumes and finds it under the config directory of the source", () => {
    expect(MCP_CONFIG_REF.name).toBe(CONFIG_MCP);
    expect(MCP_CONFIG_REF.path).toBe(`${CONFIG_PREFIX}mcp.json`);
    expect(CONFIG_PREFIX.endsWith("/")).toBe(true);
  });
});
