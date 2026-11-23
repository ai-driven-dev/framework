import { describe, expect, it } from "vitest";
import { REGISTERED_PROFILES } from "../../../../src/composition/tool-profiles/index.js";
import { DuplicateToolIdError } from "../../../../src/contexts/tools/contract/errors/tools.error.js";
import { UnregisteredToolError } from "../../../../src/shared/domain/shared.error.js";
import { catalogOf } from "../../../shared/testing/catalog-of.builder.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";

describe("the registered tool catalog", () => {
  it("names every tool in the order it was registered", () => {
    expect(catalogOf().idsInCanonicalOrder()).toEqual([
      "claude",
      "cursor",
      "copilot",
      "opencode",
      "kilo",
      "codex",
      "antigravity",
      "vscode",
    ]);
  });

  it("puts the tools delivering a native plugin first in the help order, the rest after, each in registered order", () => {
    expect(catalogOf().inHelpOrder("ai")).toEqual([
      "claude",
      "cursor",
      "copilot",
      "codex",
      "opencode",
      "kilo",
      "antigravity",
    ]);
    expect(catalogOf().inHelpOrder("ide")).toEqual(["vscode"]);
    expect(catalogOf([...REGISTERED_PROFILES].reverse()).inHelpOrder("ai")).toEqual([
      "codex",
      "copilot",
      "cursor",
      "claude",
      "antigravity",
      "kilo",
      "opencode",
    ]);
  });

  it("sorts by id whatever order its profiles were registered in", () => {
    const sorted = catalogOf([...REGISTERED_PROFILES].reverse()).sortedIds();

    expect(sorted[0]).toBe("antigravity");
  });

  it("answers the profile of a registered id, and refuses an unregistered one", () => {
    expect(catalogOf().profile(TOOL.claude).toolId).toBe("claude");
    expect(() => catalogOf([]).profile(TOOL.claude)).toThrow(UnregisteredToolError);
  });

  it("answers the registered id a text names, and null for another text", () => {
    expect(catalogOf().toolId("vscode")).toBe("vscode");
    expect(catalogOf().toolId("nope")).toBeNull();
    expect(catalogOf().aiToolId("claude")).toBe("claude");
    expect(catalogOf().aiToolId("vscode")).toBeNull();
    expect(catalogOf().aiToolId("nope")).toBeNull();
    expect(catalogOf([]).toolId("claude")).toBeNull();
  });

  it("tells an editor from an AI tool, and neither for an unregistered tool", () => {
    expect(catalogOf().isIdeTool(TOOL.vscode)).toBe(true);
    expect(catalogOf().isIdeTool(TOOL.claude)).toBe(false);
    expect(catalogOf([]).isIdeTool(TOOL.vscode)).toBe(false);
    expect(catalogOf().isAiTool(TOOL.claude)).toBe(true);
    expect(catalogOf().isAiTool(TOOL.vscode)).toBe(false);
    expect(catalogOf([]).isAiTool(TOOL.claude)).toBe(false);
  });

  it("refuses two profiles declaring the same id", () => {
    const twice = [...REGISTERED_PROFILES.slice(0, 1), ...REGISTERED_PROFILES.slice(0, 1)];
    expect(() => catalogOf(twice)).toThrow(DuplicateToolIdError);
  });

  describe("asked by kind", () => {
    it("answers the AI profile of an AI id, and refuses an editor or an unregistered id", () => {
      expect(catalogOf().aiProfile(TOOL.claude).toolId).toBe("claude");
      // @ts-expect-error an editor id is not an AI tool id
      expect(() => catalogOf().aiProfile(TOOL.vscode)).toThrow(UnregisteredToolError);
      expect(() => catalogOf([]).aiProfile(TOOL.claude)).toThrow(UnregisteredToolError);
    });

    it("answers the IDE profile of an editor id, and refuses an AI tool or an unregistered id", () => {
      expect(catalogOf().ideProfile(TOOL.vscode).toolId).toBe("vscode");
      // @ts-expect-error an AI tool id is not an editor id
      expect(() => catalogOf().ideProfile(TOOL.claude)).toThrow(UnregisteredToolError);
      expect(() => catalogOf([]).ideProfile(TOOL.vscode)).toThrow(UnregisteredToolError);
    });

    it("answers the AI profile of an id, or null for an editor, and refuses an unregistered id", () => {
      expect(catalogOf().aiProfileIfAny(TOOL.claude)?.toolId).toBe("claude");
      expect(catalogOf().aiProfileIfAny(TOOL.vscode)).toBeNull();
      expect(() => catalogOf([]).aiProfileIfAny(TOOL.claude)).toThrow(UnregisteredToolError);
    });
  });
});
