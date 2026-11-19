import { describe, expect, it } from "vitest";
import {
  agentModelsRequest,
  expandAllKeyword,
  parsePluginsFlag,
} from "../../../src/orchestration/setup/setup-request.js";
import { catalogOf, registeredCatalog } from "../../contexts/tools/testing/catalog-of.js";

describe("expandAllKeyword", () => {
  it("selects nothing when the flag was not given", () => {
    expect(expandAllKeyword(undefined, catalogOf().idsInCanonicalOrder("ai"))).toEqual([]);
  });

  it("expands 'all' into every id of that category, spacing and all", () => {
    expect(expandAllKeyword("all", catalogOf().idsInCanonicalOrder("ide"))).toEqual([
      ...catalogOf().idsInCanonicalOrder("ide"),
    ]);
    expect(expandAllKeyword("  all  ", catalogOf().idsInCanonicalOrder("ide"))).toEqual([
      ...catalogOf().idsInCanonicalOrder("ide"),
    ]);
  });

  it("splits a comma-separated list, dropping the spacing and the empty entries", () => {
    expect(expandAllKeyword(" claude , , cursor ", catalogOf().idsInCanonicalOrder("ai"))).toEqual([
      "claude",
      "cursor",
    ]);
  });
});

describe("parsePluginsFlag", () => {
  it("asks on a terminal when --plugins was not given", () => {
    expect(parsePluginsFlag(undefined, true)).toEqual({ mode: "interactive", names: [] });
  });

  it("installs nothing off a terminal when --plugins was not given", () => {
    expect(parsePluginsFlag(undefined, false)).toEqual({ mode: "none", names: [] });
  });

  it("reads each of the three keywords as its own mode, spacing and all", () => {
    expect(parsePluginsFlag("  none  ", true)).toEqual({ mode: "none", names: [] });
    expect(parsePluginsFlag("all", true)).toEqual({ mode: "all", names: [] });
    expect(parsePluginsFlag("recommended", true)).toEqual({ mode: "recommended", names: [] });
  });

  it("reads anything else as the names to install", () => {
    expect(parsePluginsFlag(" aidd-dev , aidd-pm ,", true)).toEqual({
      mode: "named",
      names: ["aidd-dev", "aidd-pm"],
    });
  });
});

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

  it("asks for an --ide tool that runs the agents when none was given", () => {
    expect(() => agentModelsRequest("openai", ["vscode"], registeredCatalog())).toThrow(
      "--provider needs --ide with a tool"
    );
  });
});
