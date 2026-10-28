import { describe, expect, it } from "vitest";
import { claude } from "../../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
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
---
${BODY}`;

describe("claude agents", () => {
  describe("name resolution", () => {
    it("installs a plugin agent under its declared name", () => {
      expect(installed(claude, NAMED_AGENT)).toBe(NATIVE);
    });

    it("names an unnamed plugin agent after its file", () => {
      expect(installed(claude, UNNAMED_AGENT)).toBe(NATIVE);
    });

    it("keeps the declared name inside the plugin of a marketplace build", () => {
      expect(built(claude, "marketplace", NAMED_AGENT)).toStrictEqual({
        path: "agents/explorer.md",
        content: NATIVE,
      });
    });

    it("prefixes the name with the plugin in a flat build, which shares one agents directory", () => {
      expect(built(claude, "flat", NAMED_AGENT)).toStrictEqual({
        path: ".claude/agents/aidd-orchestrator-explorer.md",
        content: NATIVE.replace("'explorer'", "'aidd-orchestrator-explorer'"),
      });
    });
  });

  it("keeps the model and effort under Claude's own keys", () => {
    expect(installed(claude, withModel(NAMED_AGENT))).toBe(`---
name: 'explorer'
description: '${DESCRIPTION}'
model: 'm'
effort: 'high'
---
${BODY}`);
  });

  describe("capabilities.agents.buildInstallPath()", () => {
    it("builds path for agents section", () => {
      const path = claude.capabilities.agents.buildInstallPath("code-reviewer.md");
      expect(path).toBe(".claude/agents/code-reviewer.md");
    });
  });
});
