import { describe, expect, it } from "vitest";
import {
  agentModelsRequest,
  isInteractiveRun,
  selectTools,
} from "../../../src/orchestration/setup/setup-request.js";
import { registeredCatalog } from "../../contexts/tools/testing/catalog-of.js";

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
