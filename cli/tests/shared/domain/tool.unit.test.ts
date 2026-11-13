import { describe, expect, it } from "vitest";
import {
  CategoryMismatchError,
  UnknownAiToolIdError,
  UnknownToolCategoryError,
} from "../../../src/shared/domain/errors.js";
import {
  AI_TOOL_IDS,
  assertToolIdsMatchCategory,
  assertValidAiToolId,
  IDE_TOOL_IDS,
  isAiToolId,
  isIdeToolId,
  parseToolOption,
  type ToolCategory,
  toolIdsForCategory,
} from "../../../src/shared/domain/tool.js";

describe("isAiToolId", () => {
  it("returns true for known AI tool IDs", () => {
    expect(isAiToolId("claude")).toBe(true);
    expect(isAiToolId("cursor")).toBe(true);
    expect(isAiToolId("copilot")).toBe(true);
    expect(isAiToolId("opencode")).toBe(true);
    expect(isAiToolId("codex")).toBe(true);
  });

  it("returns false for unknown strings", () => {
    expect(isAiToolId("unknown")).toBe(false);
    expect(isAiToolId("vscode")).toBe(false);
    expect(isAiToolId("")).toBe(false);
  });
});

describe("parseToolOption", () => {
  it("returns 'all' when argument is undefined", () => {
    expect(parseToolOption(undefined)).toBe("all");
  });

  it("returns 'all' when argument is the string 'all'", () => {
    expect(parseToolOption("all")).toBe("all");
  });

  it("returns a single-element array for a named tool", () => {
    expect(parseToolOption("claude")).toEqual(["claude"]);
    expect(parseToolOption("cursor")).toEqual(["cursor"]);
  });
});

describe("assertValidAiToolId", () => {
  it("does not throw when id is undefined", () => {
    expect(() => assertValidAiToolId(undefined)).not.toThrow();
  });

  it("does not throw when id is 'all'", () => {
    expect(() => assertValidAiToolId("all")).not.toThrow();
  });

  it("does not throw for valid AI tool IDs", () => {
    expect(() => assertValidAiToolId("claude")).not.toThrow();
    expect(() => assertValidAiToolId("cursor")).not.toThrow();
  });

  it("throws UnknownAiToolIdError for invalid IDs", () => {
    expect(() => assertValidAiToolId("invalid-tool")).toThrow(UnknownAiToolIdError);
    expect(() => assertValidAiToolId("vscode")).toThrow(UnknownAiToolIdError);
  });
});

describe("the tool categories", () => {
  it("lists the AI ids for 'ai' and the IDE ids for 'ide'", () => {
    expect(toolIdsForCategory("ai")).toEqual(AI_TOOL_IDS);
    expect(toolIdsForCategory("ide")).toEqual(IDE_TOOL_IDS);
  });

  it("refuses a category that is neither", () => {
    const other: string = "editor";
    expect(() => toolIdsForCategory(other as ToolCategory)).toThrow(UnknownToolCategoryError);
  });

  it("accepts ids of the category", () => {
    expect(() => assertToolIdsMatchCategory(["claude", "cursor"], "ai")).not.toThrow();
    expect(() => assertToolIdsMatchCategory(["vscode"], "ide")).not.toThrow();
  });

  it("names every id outside the category", () => {
    expect(() => assertToolIdsMatchCategory(["vscode"], "ai")).toThrow(/vscode is not an AI tool/);
    expect(() => assertToolIdsMatchCategory(["claude"], "ide")).toThrow(
      /claude is not an IDE tool/
    );
    expect(() => assertToolIdsMatchCategory(["claude", "cursor"], "ide")).toThrow(
      /claude, cursor are not IDE tools/
    );
    expect(() => assertToolIdsMatchCategory(["claude"], "ide")).toThrow(CategoryMismatchError);
  });
});

describe("isIdeToolId", () => {
  it("is true for an IDE id and false for an AI id or an unknown string", () => {
    expect(isIdeToolId("vscode")).toBe(true);
    expect(isIdeToolId("claude")).toBe(false);
    expect(isIdeToolId("unknown")).toBe(false);
  });
});
