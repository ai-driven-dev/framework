import { describe, expect, it } from "vitest";
import {
  agentModelsRequest,
  isInteractiveRun,
  selectTools,
} from "../../../src/orchestration/setup/setup-request.js";
import { CategoryMismatchError } from "../../../src/shared/domain/errors/category-mismatch-error.js";
import { registeredCatalog } from "../../shared/testing/catalog-of.builder.js";

describe("agentModelsRequest", () => {
  it("names the tool that does not run the provider asked for", () => {
    expect(() => agentModelsRequest("openai", ["claude", "codex"], registeredCatalog())).toThrow(
      'not supported for "claude"'
    );
  });

  it("refuses a provider no tool knows", () => {
    expect(() => agentModelsRequest("bogus", ["vscode"], registeredCatalog())).toThrow(
      'Unknown provider "bogus"'
    );
  });

  it("reports the tools that run the agents, whichever the run names", () => {
    const request = agentModelsRequest("openai", ["vscode"], registeredCatalog());

    expect(request.hosts).toEqual([]);
    expect(request.runnable).toContain("claude");
  });
});

describe("selectTools", () => {
  it("files every id under the list its category decides, --ai ones first", () => {
    expect(selectTools(["codex"], ["claude", "vscode"], registeredCatalog())).toStrictEqual({
      aiTools: ["codex", "claude"],
      ideTools: ["vscode"],
    });
  });
});

describe("selectTools refusal", () => {
  it("refuses ids of another category, and an unknown one with them, naming the valid AI tools", () => {
    const refuse = () => selectTools(["vscode", "nope"], [], registeredCatalog());

    expect(refuse).toThrow(CategoryMismatchError);
    expect(refuse).toThrow(
      "vscode, nope are not AI tools. Valid AI tools: claude, cursor, copilot, opencode, kilo, codex, antigravity"
    );
  });
});

describe("isInteractiveRun", () => {
  it("asks on a terminal when no scripting flag was given", () => {
    expect(isInteractiveRun(true, [undefined, "", false])).toBe(true);
  });

  it("stays silent as soon as one scripting flag was given", () => {
    expect(isInteractiveRun(true, [undefined, "claude"])).toBe(false);
  });

  it("stays silent off a terminal", () => {
    expect(isInteractiveRun(false, [])).toBe(false);
  });
});
