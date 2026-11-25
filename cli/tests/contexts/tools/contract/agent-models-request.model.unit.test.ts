import { describe, expect, it } from "vitest";
import { agentModelsRequest } from "../../../../src/contexts/tools/contract/agent-models-request.model.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_IDE_TOOL,
  SYNTHETIC_TOOL,
  syntheticMixedCatalog,
} from "../../../shared/testing/synthetic-tool-id.builder.js";

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
