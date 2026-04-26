import { describe, expect, it } from "vitest";
import { formatToolScopeValue, parseUpdateScope } from "../../../src/domain/models/tool-scope.js";

describe("parseUpdateScope", () => {
  it('parses "all"', () => {
    expect(parseUpdateScope("all")).toEqual({ kind: "all" });
  });

  it('parses "docs"', () => {
    expect(parseUpdateScope("docs")).toEqual({ kind: "docs" });
  });

  it('parses "tool:claude"', () => {
    expect(parseUpdateScope("tool:claude")).toEqual({ kind: "tool", toolId: "claude" });
  });

  it('parses "tool:cursor"', () => {
    expect(parseUpdateScope("tool:cursor")).toEqual({ kind: "tool", toolId: "cursor" });
  });

  it('parses "tool:copilot"', () => {
    expect(parseUpdateScope("tool:copilot")).toEqual({ kind: "tool", toolId: "copilot" });
  });

  it('parses "tool:opencode"', () => {
    expect(parseUpdateScope("tool:opencode")).toEqual({ kind: "tool", toolId: "opencode" });
  });

  it("rejects an unknown scope with an error", () => {
    expect(() => parseUpdateScope("unknown")).toThrow('Invalid update scope: "unknown"');
  });
});

describe("formatToolScopeValue", () => {
  it("formats claude toolId", () => {
    expect(formatToolScopeValue("claude")).toBe("tool:claude");
  });

  it("formats cursor toolId", () => {
    expect(formatToolScopeValue("cursor")).toBe("tool:cursor");
  });

  it("round-trip: formatToolScopeValue then parseUpdateScope", () => {
    const formatted = formatToolScopeValue("claude");
    const parsed = parseUpdateScope(formatted);
    expect(parsed).toEqual({ kind: "tool", toolId: "claude" });
  });

  it("round-trip: all tool ids", () => {
    const toolIds = ["claude", "cursor", "copilot", "opencode"] as const;
    for (const toolId of toolIds) {
      const formatted = formatToolScopeValue(toolId);
      const parsed = parseUpdateScope(formatted);
      expect(parsed).toEqual({ kind: "tool", toolId });
    }
  });
});
