import { describe, expect, it } from "vitest";
import { codex } from "../../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import {
  BODY,
  built,
  DESCRIPTION,
  installed,
  NAMED_AGENT,
  UNNAMED_AGENT,
  withModel,
} from "../agent-fixture.js";

/** smol-toml writes a string as JSON does, which this body (no DEL, no lone surrogate) keeps. */
const INSTRUCTIONS = `developer_instructions = ${JSON.stringify(BODY)}
`;

const NATIVE = `name = "explorer"
description = "${DESCRIPTION}"
${INSTRUCTIONS}`;

const PREFIXED = NATIVE.replace('"explorer"', '"aidd-orchestrator-explorer"');

describe("codex agents", () => {
  describe("name resolution", () => {
    it("installs a plugin agent under its declared name, the body as its instructions", () => {
      expect(installed(codex, NAMED_AGENT)).toBe(NATIVE);
    });

    it("names an unnamed plugin agent after its file", () => {
      expect(installed(codex, UNNAMED_AGENT)).toBe(NATIVE);
    });

    it("prefixes the name with the plugin in a marketplace build, which Codex copies into one directory", () => {
      expect(built(codex, "marketplace", NAMED_AGENT)).toStrictEqual({
        path: "codex-agents/explorer.toml",
        content: PREFIXED,
      });
    });

    it("prefixes the name with the plugin in a flat build", () => {
      expect(built(codex, "flat", NAMED_AGENT)).toStrictEqual({
        path: ".codex/agents/aidd-orchestrator-explorer.toml",
        content: PREFIXED,
      });
    });
  });

  it("writes the effort as model_reasoning_effort", () => {
    expect(installed(codex, withModel(NAMED_AGENT))).toBe(`name = "explorer"
description = "${DESCRIPTION}"
model = "m"
model_reasoning_effort = "high"
${INSTRUCTIONS}`);
  });

  describe("capabilities.agents.buildInstallPath()", () => {
    it("builds .toml path under .codex/agents/", () => {
      const path = codex.capabilities.agents.buildInstallPath("alexia.md");
      expect(path).toBe(".codex/agents/alexia.toml");
    });
  });
});
