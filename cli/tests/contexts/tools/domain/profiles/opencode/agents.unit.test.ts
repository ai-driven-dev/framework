import { describe, expect, it } from "vitest";
import { opencode } from "../../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
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
description: '${DESCRIPTION}'
mode: 'subagent'
---
${BODY}`;

describe("opencode agents", () => {
  describe("name resolution", () => {
    it("names a plugin agent after its file, so no name", () => {
      expect(installed(opencode, NAMED_AGENT)).toBe(NATIVE);
    });

    it("writes an unnamed plugin agent the same way", () => {
      expect(installed(opencode, UNNAMED_AGENT)).toBe(NATIVE);
    });

    it("prefixes the file with the plugin in a flat build, which is the agent's name", () => {
      expect(built(opencode, "flat", NAMED_AGENT)).toStrictEqual({
        path: ".opencode/agents/aidd-orchestrator-explorer.md",
        content: NATIVE,
      });
    });
  });

  it("writes the effort as the model's variant", () => {
    expect(installed(opencode, withModel(NAMED_AGENT))).toBe(`---
description: '${DESCRIPTION}'
model: 'm#high'
mode: 'subagent'
---
${BODY}`);
  });

  describe("capabilities.agents.buildInstallPath()", () => {
    it("builds path under .opencode/agents/", () => {
      const path = opencode.capabilities.agents.buildInstallPath("code-reviewer.md");
      expect(path).toBe(".opencode/agents/code-reviewer.md");
    });

    it("strips .opencode.md tool suffix", () => {
      const path = opencode.capabilities.agents.buildInstallPath("alexia.opencode.md");
      expect(path).toBe(".opencode/agents/alexia.md");
    });
  });
});
