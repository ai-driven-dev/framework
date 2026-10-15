import { describe, expect, it } from "vitest";
import type { ToolBuildContract } from "../../../../../src/contexts/tools/domain/build-contract.js";
import { agentModelOptions } from "../../../../../src/contexts/tools/domain/formats/agent-models.js";
import recommendations from "../../../../../src/contexts/tools/domain/formats/agent-models.json" with {
  type: "json",
};
import { claude } from "../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import { codex } from "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import { parseToml } from "../../../../../src/contexts/tools/domain/profiles/codex/toml.js";
import { copilot } from "../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import {
  buildCursorContract,
  buildCursorFlatContract,
} from "../../../../../src/contexts/tools/domain/profiles/cursor/build.js";
import { opencode } from "../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { parseFrontmatter } from "../../../../../src/kernel/markdown.js";

const hosts = [
  ["claude", claude, { model: "claude-haiku-5-5", effort: "medium" }],
  ["codex", codex, { model: "gpt-6-luna", model_reasoning_effort: "medium" }],
  ["copilot", copilot, { model: "gpt-6-luna", reasoningEffort: "medium" }],
  ["opencode", opencode, { model: "openai/gpt-6-luna#medium" }],
] as const;

function transform(contract: ToolBuildContract, plugin: string, role: string, fields = "") {
  const artifact = contract.artifacts.agents;
  if (!artifact.supported || artifact.transform === undefined)
    throw new Error("Missing agent transform");
  return artifact.transform(
    `---\nname: ${role}\ndescription: Role\n${fields}---\nBody\n`,
    plugin,
    `${role}.md`
  );
}

function fields(content: string, toml: boolean) {
  return toml ? parseToml(content) : parseFrontmatter(content).frontmatter;
}

describe("installed agent model recommendations", () => {
  it("selects Copilot's native model identifier when its provider is changed to Anthropic", () => {
    const configuration = structuredClone(recommendations);
    configuration.tools.copilot.provider = "anthropic";
    expect(
      agentModelOptions("copilot", {}, "aidd-dev", "explorer.md", "flat", configuration)
    ).toStrictEqual({
      model: "claude-haiku-5.5",
      reasoningEffort: "medium",
    });
    expect(agentModelOptions("copilot", {}, "aidd-dev", "explorer.md")).toStrictEqual({
      model: "gpt-6-luna",
      reasoningEffort: "medium",
    });
  });
  for (const [label, host, expected] of hosts) {
    it.each(["explorer", "executor", "reviewer", "validator"])(
      `${label} installs native defaults for the AIDD %s role`,
      (role) => {
        const capability = host.capabilities.agents;
        const converted = capability.convertFrontmatter(
          { name: role, description: "Role" },
          `${role}.md`,
          "aidd-dev"
        );
        expect(fields(capability.serialize(converted, "Body"), label === "codex")).toMatchObject(
          expected
        );
      }
    );
    it(`${label} preserves explicit native settings and leaves unrelated installations unpinned`, () => {
      const capability = host.capabilities.agents;
      const explicit = capability.convertFrontmatter(
        {
          name: "explorer",
          model: "custom-native",
          effort: "high",
          model_reasoning_effort: "high",
          reasoningEffort: "high",
        },
        "explorer.md",
        "aidd-dev"
      );
      expect(explicit.model).toBe("custom-native");
      for (const field of Object.keys(expected).filter((field) => field !== "model"))
        expect(explicit[field]).toBe("high");
      expect(
        capability.convertFrontmatter({ name: "explorer" }, "explorer.md", "personal")
      ).not.toHaveProperty("model");
    });
    for (const [mode, build] of Object.entries(host.buildContracts ?? {})) {
      it(`${label} ${mode} build writes native recommendations`, () => {
        expect(fields(transform(build(), "aidd-dev", "explorer"), label === "codex")).toMatchObject(
          expected
        );
      });
      it(`${label} ${mode} build preserves an explicit model and unrelated agents`, () => {
        const explicit = fields(
          transform(build(), "aidd-dev", "explorer", "model: custom-native\n"),
          label === "codex"
        );
        expect(explicit.model).toBe("custom-native");
        expect(
          fields(transform(build(), "personal", "explorer"), label === "codex")
        ).not.toHaveProperty("model");
        expect(
          fields(transform(build(), "aidd-dev", "planner"), label === "codex")
        ).not.toHaveProperty("model");
      });
    }
  }
  it("Cursor flat agents carry the native model parameter while plugin agents inherit", () => {
    expect(
      fields(transform(buildCursorFlatContract(), "aidd-dev", "explorer"), false)
    ).toMatchObject({ model: "claude-haiku-5-5[effort=medium]" });
    expect(
      fields(transform(buildCursorContract(), "aidd-dev", "explorer"), false)
    ).not.toHaveProperty("model");
  });
});
