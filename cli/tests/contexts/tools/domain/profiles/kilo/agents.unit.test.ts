import { describe, expect, it } from "vitest";
import { kilo } from "../../../../../../src/contexts/tools/domain/profiles/kilo/profile.js";
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

describe("kilo agents", () => {
  describe("name resolution", () => {
    it("names a plugin agent after its file, so no name", () => {
      expect(installed(kilo, NAMED_AGENT)).toBe(NATIVE);
    });

    it("writes an unnamed plugin agent the same way", () => {
      expect(installed(kilo, UNNAMED_AGENT)).toBe(NATIVE);
    });

    it("prefixes the file with the plugin in a flat build, which is the agent's name", () => {
      expect(built(kilo, "flat", NAMED_AGENT)).toStrictEqual({
        path: ".kilo/agents/aidd-orchestrator-explorer.md",
        content: NATIVE,
      });
    });
  });

  it("writes the effort as the model's variant", () => {
    expect(installed(kilo, withModel(NAMED_AGENT))).toBe(`---
description: '${DESCRIPTION}'
model: 'm'
variant: 'high'
mode: 'subagent'
---
${BODY}`);
  });
});
