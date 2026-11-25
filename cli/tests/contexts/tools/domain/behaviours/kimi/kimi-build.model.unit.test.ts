import { describe, expect, it } from "vitest";
import { kimi } from "../../../../../../src/composition/tool-profiles/kimi.js";
import { artifactPath } from "../../../../../../src/shared/domain/materialization/artifact-path.js";
import { present } from "../../../../../shared/testing/present.builder.js";
import { supported } from "../../../testing/build-artifacts.builder.js";

describe("building Kimi's flat contract", () => {
  const artifacts = present(kimi.buildContracts.flat)().artifacts;

  it("sits a skill in the shared skills folder, the plugin hyphenated onto its name", () => {
    expect(artifactPath(supported(artifacts.skills), "aidd-dev", "skills/01-plan/SKILL.md")).toBe(
      ".agents/skills/aidd-dev-01-plan/SKILL.md"
    );
  });

  it("sits an agent in Kimi's own folder, named after its plugin", () => {
    expect(artifactPath(supported(artifacts.agents), "aidd-dev", "agents/executor.md")).toBe(
      ".kimi-code/agents/aidd-dev-executor/agent.md"
    );
  });

  it("writes MCP servers to Kimi's project file and ships no hooks", () => {
    expect(supported(artifacts.mcp).placement).toEqual({ kind: "file", at: ".kimi-code/mcp.json" });
    expect(artifacts.hooks.supported).toBe(false);
  });
});
