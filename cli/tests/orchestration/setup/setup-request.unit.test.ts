import { describe, expect, it } from "vitest";
import { CategoryMismatchError } from "../../../src/orchestration/orchestration.error.js";
import {
  agentModelsRequest,
  isInteractiveRun,
  selectTools,
} from "../../../src/orchestration/setup/setup-request.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_IDE_TOOL,
  SYNTHETIC_TOOL,
  syntheticMixedCatalog,
} from "../../shared/testing/synthetic-tool-id.builder.js";

describe("reading the agent models request", () => {
  it("names the tool that does not run the provider asked for", () => {
    expect(() =>
      agentModelsRequest("openai", [SYNTHETIC_TOOL, SECOND_SYNTHETIC_TOOL], syntheticMixedCatalog())
    ).toThrow(`not supported for "${SYNTHETIC_TOOL}"`);
  });

  it("refuses a provider no tool knows", () => {
    expect(() =>
      agentModelsRequest("bogus", [SYNTHETIC_IDE_TOOL], syntheticMixedCatalog())
    ).toThrow('Unknown provider "bogus"');
  });

  it("reports the tools that run the agents, whichever the run names", () => {
    const request = agentModelsRequest("openai", [SYNTHETIC_IDE_TOOL], syntheticMixedCatalog());

    expect(request.hosts).toEqual([]);
    expect(request.runnable).toContain(SYNTHETIC_TOOL);
  });
});

describe("selecting tools", () => {
  it("files every id under the list its category decides, --ai ones first", () => {
    expect(
      selectTools(
        [SECOND_SYNTHETIC_TOOL],
        [SYNTHETIC_TOOL, SYNTHETIC_IDE_TOOL],
        syntheticMixedCatalog()
      )
    ).toStrictEqual({
      aiTools: [SECOND_SYNTHETIC_TOOL, SYNTHETIC_TOOL],
      ideTools: [SYNTHETIC_IDE_TOOL],
    });
  });
});

describe("selectTools refusal", () => {
  it("refuses ids of another category, and an unknown one with them, naming the valid AI tools", () => {
    const refuse = () => selectTools([SYNTHETIC_IDE_TOOL, "nope"], [], syntheticMixedCatalog());

    expect(refuse).toThrow(CategoryMismatchError);
    expect(refuse).toThrow(
      expect.objectContaining({
        wrong: [SYNTHETIC_IDE_TOOL, "nope"],
        category: "ai",
        validToolIds: [SYNTHETIC_TOOL, SECOND_SYNTHETIC_TOOL],
      })
    );
  });
});

describe("telling an interactive run", () => {
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
