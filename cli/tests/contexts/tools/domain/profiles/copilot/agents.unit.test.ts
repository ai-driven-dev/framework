import { describe, expect, it } from "vitest";
import { copilot } from "../../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import {
  BODY,
  built,
  DESCRIPTION,
  installed,
  NAMED_AGENT,
  UNNAMED_AGENT,
  withModel,
} from "../agent-fixture.js";

const NATIVE = `---
name: 'explorer'
description: '${DESCRIPTION}'
include-custom-instructions: true
---
${BODY}`;

describe("copilot agents", () => {
  describe("name resolution", () => {
    it("installs a plugin agent under its declared name, with the repository instructions", () => {
      expect(installed(copilot, NAMED_AGENT)).toBe(NATIVE);
    });

    it("names an unnamed plugin agent after its file", () => {
      expect(installed(copilot, UNNAMED_AGENT)).toBe(NATIVE);
    });

    it("keeps the declared name inside the plugin of a marketplace build", () => {
      expect(built(copilot, "marketplace", NAMED_AGENT)).toStrictEqual({
        path: "agents/explorer.md",
        content: NATIVE,
      });
    });

    it("prefixes the name with the plugin in a flat build", () => {
      expect(built(copilot, "flat", NAMED_AGENT)).toStrictEqual({
        path: ".github/agents/aidd-orchestrator-explorer.agent.md",
        content: NATIVE.replace("'explorer'", "'aidd-orchestrator-explorer'"),
      });
    });
  });

  it("writes the effort as reasoningEffort", () => {
    expect(installed(copilot, withModel(NAMED_AGENT))).toBe(`---
name: 'explorer'
description: '${DESCRIPTION}'
model: 'm'
reasoningEffort: 'high'
include-custom-instructions: true
---
${BODY}`);
  });

  it("keeps an explicit opt-out of the repository instructions", () => {
    expect(
      copilot.capabilities.agents.convertFrontmatter({
        name: "reviewer",
        "include-custom-instructions": false,
      })
    ).toHaveProperty("include-custom-instructions", false);
  });

  describe("capabilities.agents.buildInstallPath()", () => {
    it("adds .agent.md extension", () => {
      const path = copilot.capabilities.agents.buildInstallPath("code-reviewer.md");
      expect(path).toBe(".github/agents/code-reviewer.agent.md");
    });

    it("returns null for .gitkeep files", () => {
      expect(copilot.capabilities.agents.buildInstallPath(".gitkeep")).toBeNull();
    });

    it("names a nested agent after its own file, not the folders above it", () => {
      const path = copilot.capabilities.agents.buildInstallPath("team/sub/code-reviewer.md");
      expect(path).toBe(".github/agents/code-reviewer.agent.md");
    });

    it("keeps a file that is not markdown under its own name", () => {
      const path = copilot.capabilities.agents.buildInstallPath("helper.txt");
      expect(path).toBe(".github/agents/helper.txt");
    });
  });
});
