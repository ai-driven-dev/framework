import { describe, expect, it } from "vitest";
import { copilot } from "../../../../../../src/composition/tool-profiles/copilot.js";

describe("copilot mcp", () => {
  it("maps mcp to .vscode/mcp.json", () => {
    expect(copilot.section("mcp").config?.accepts(".vscode/mcp.json")).toBe(true);
  });
});
