import { describe, expect, it } from "vitest";
import { cursor } from "../../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
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
name: "explorer"
description: "${DESCRIPTION}"
---
${BODY}`;

const PREFIXED = NATIVE.replace('"explorer"', '"aidd-orchestrator-explorer"');

describe("cursor agents", () => {
  describe("name resolution", () => {
    it("installs a plugin agent under its declared name, double-quoted", () => {
      expect(installed(cursor, NAMED_AGENT)).toBe(NATIVE);
    });

    it("names an unnamed plugin agent after its file", () => {
      expect(installed(cursor, UNNAMED_AGENT)).toBe(NATIVE);
    });

    it("prefixes the name with the plugin in a marketplace build", () => {
      expect(built(cursor, "marketplace", NAMED_AGENT)).toStrictEqual({
        path: "agents/explorer.md",
        content: PREFIXED,
      });
    });

    it("prefixes the name with the plugin in a flat build", () => {
      expect(built(cursor, "flat", NAMED_AGENT)).toStrictEqual({
        path: ".cursor/agents/aidd-orchestrator-explorer.md",
        content: PREFIXED,
      });
    });
  });

  it("writes the effort inside the model, Cursor having no effort key", () => {
    expect(installed(cursor, withModel(NAMED_AGENT))).toBe(`---
name: "explorer"
description: "${DESCRIPTION}"
model: "m[effort=high]"
---
${BODY}`);
  });

  describe("capabilities.agents.buildInstallPath()", () => {
    it("keeps .md extension for agents", () => {
      const path = cursor.capabilities.agents.buildInstallPath("code-reviewer.md");
      expect(path).toBe(".cursor/agents/code-reviewer.md");
    });
  });
});
