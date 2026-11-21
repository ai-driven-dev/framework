import { describe, expect, it } from "vitest";
import { CategoryMismatchError } from "../../../../src/shared/domain/errors/category-mismatch-error.js";

describe("CategoryMismatchError", () => {
  it("says exactly what went wrong (1)", () => {
    const error = new CategoryMismatchError(["vscode"], "ai", ["claude", "cursor"]);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "CategoryMismatchError",
      message: "vscode is not an AI tool. Valid AI tools: claude, cursor",
    });
  });

  it("says exactly what went wrong (2)", () => {
    const error = new CategoryMismatchError(["claude", "cursor"], "ide", ["vscode"]);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "CategoryMismatchError",
      message: "claude, cursor are not IDE tools. Valid IDE tools: vscode",
    });
  });

  it("carries its stable code", () => {
    expect(new CategoryMismatchError(["vscode"], "ai", ["claude", "cursor"]).code).toBe(
      "category-mismatch"
    );
  });
});
