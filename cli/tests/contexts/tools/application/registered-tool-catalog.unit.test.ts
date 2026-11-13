import { describe, expect, it } from "vitest";
import { RegisteredToolCatalog } from "../../../../src/contexts/tools/application/registered-tool-catalog.js";
import {
  CANONICAL_PROFILES,
  REGISTERED_PROFILES,
} from "../../../../src/contexts/tools/domain/profiles/registered-profiles.js";
import {
  DuplicateToolIdError,
  ToolListMismatchError,
  UnregisteredToolError,
} from "../../../../src/shared/domain/errors.js";
import type { AiToolId, IdeToolId } from "../../../../src/shared/domain/tool.js";
import { catalogOf, TOOL } from "../testing/catalog-of.js";

describe("the registered tool catalog", () => {
  it("follows the order its profiles were registered in, not the id order", () => {
    const catalog = catalogOf([...REGISTERED_PROFILES].reverse());

    expect(catalog.inHelpOrder("ai")[0]).toBe("antigravity");
    expect(catalog.inHelpOrder("ai").at(-1)).toBe("claude");
  });

  it("sorts by id whatever order its profiles were registered in", () => {
    const sorted = catalogOf([...REGISTERED_PROFILES].reverse()).sortedById();

    expect(sorted[0]?.toolId).toBe("antigravity");
  });

  describe("the AI ids in the canonical order", () => {
    it("is the order the shared vocabulary names the AI tools in, which is neither the help order nor the id order", () => {
      const ids = catalogOf().idsInCanonicalOrder("ai");

      expect(ids.indexOf(TOOL.opencode)).toBeLessThan(ids.indexOf(TOOL.codex));
      expect(ids).not.toEqual(catalogOf().inHelpOrder("ai"));
    });
  });

  it("answers the profile of a registered id, and refuses an unregistered one", () => {
    expect(catalogOf().profile(TOOL.claude).toolId).toBe("claude");
    expect(() => catalogOf([]).profile(TOOL.claude)).toThrow(UnregisteredToolError);
  });

  it("refuses a canonical order that is not the registration's own set", () => {
    const registered = REGISTERED_PROFILES.slice(1);
    const missing = () => new RegisteredToolCatalog(registered, CANONICAL_PROFILES);
    const extra = () => new RegisteredToolCatalog(REGISTERED_PROFILES, CANONICAL_PROFILES.slice(1));

    expect(missing).toThrow(ToolListMismatchError);
    expect(missing).toThrow("Tool lists differ on: claude.");
    expect(extra).toThrow("Tool lists differ on: claude.");
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
    const ide: string = "vscode";
    const ai: string = "claude";

    it("answers the AI profile of an AI id, and refuses an editor or an unregistered id", () => {
      expect(catalogOf().aiProfile(TOOL.claude).toolId).toBe("claude");
      expect(() => catalogOf().aiProfile(ide as AiToolId)).toThrow(UnregisteredToolError);
      expect(() => catalogOf([]).aiProfile(TOOL.claude)).toThrow(UnregisteredToolError);
    });

    it("answers the IDE profile of an editor id, and refuses an AI tool or an unregistered id", () => {
      expect(catalogOf().ideProfile(TOOL.vscode).toolId).toBe("vscode");
      expect(() => catalogOf().ideProfile(ai as IdeToolId)).toThrow(UnregisteredToolError);
      expect(() => catalogOf([]).ideProfile(TOOL.vscode)).toThrow(UnregisteredToolError);
    });

    it("answers the AI profile of an id, or null for an editor, and refuses an unregistered id", () => {
      expect(catalogOf().aiProfileIfAny(TOOL.claude)?.toolId).toBe("claude");
      expect(catalogOf().aiProfileIfAny(TOOL.vscode)).toBeNull();
      expect(() => catalogOf([]).aiProfileIfAny(TOOL.claude)).toThrow(UnregisteredToolError);
    });
  });
});
