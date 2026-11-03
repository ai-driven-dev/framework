import { describe, expect, it } from "vitest";
import { codex } from "../../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import { inMarketplace, installed, NAMED_AGENT, UNNAMED_AGENT } from "../agent-fixture.js";

const PREFIXED = `name = "aidd-dev-planner"
description = "Plans the work"
model = "m"
model_reasoning_effort = "high"
developer_instructions = "Plan before building.\\n"
`;

describe("codex agents", () => {
  describe("name resolution", () => {
    it("installs a plugin agent under its declared name, effort as model_reasoning_effort", () => {
      expect(installed(codex, NAMED_AGENT)).toBe(`name = "planner"
description = "Plans the work"
model = "m"
model_reasoning_effort = "high"
developer_instructions = "Plan before building.\\n"
`);
    });

    it("names an unnamed plugin agent after its file", () => {
      expect(installed(codex, UNNAMED_AGENT)).toBe(`name = "planner"
description = "Plans the work"
developer_instructions = "Plan before building.\\n"
`);
    });

    it("prefixes the name with the plugin in a marketplace build, which Codex copies into one directory", () => {
      expect(inMarketplace(codex, NAMED_AGENT)).toStrictEqual({
        path: "codex-agents/planner.toml",
        content: PREFIXED,
      });
    });
  });

  describe("capabilities.agents.buildInstallPath()", () => {
    it("builds .toml path under .codex/agents/", () => {
      const path = codex.capabilities.agents.buildInstallPath("alexia.md");
      expect(path).toBe(".codex/agents/alexia.toml");
    });
  });
});
