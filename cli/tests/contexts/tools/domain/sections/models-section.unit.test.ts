import { describe, expect, it } from "vitest";
import type { ToolBuildContract } from "../../../../../src/contexts/tools/contract/build-contract.js";
import { ModelsSection } from "../../../../../src/contexts/tools/domain/sections/models-section.js";
import type { AiToolId } from "../../../../../src/shared/domain/tool.js";
import { builtAgent } from "../../../../shared/testing/built-agent.builder.js";
import { registeredAiProfile } from "../../../../shared/testing/catalog-of.builder.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

/** The tool's flat build, its agents on the provider's models. */
function withAgentModels(tool: AiToolId, provider: string): ToolBuildContract {
  const contract = registeredAiProfile(tool).buildContract("flat", provider);
  if (contract === null) throw new Error("no flat build");
  return contract;
}

function plainContract(tool: AiToolId): ToolBuildContract {
  const contract = registeredAiProfile(tool).buildContract("flat");
  if (contract === null) throw new Error("no flat build");
  return contract;
}

const AGENT = `---
description: Reviews the work
---
Review.
`;

function write(contract: ToolBuildContract, fileName: string, content = AGENT): string {
  return builtAgent(contract, "flat")(content, "aidd-orchestrator", fileName);
}

describe("a build on a provider", () => {
  it("gives a light role the provider's light model and effort, in the host's keys", () => {
    expect(
      write(withAgentModels(TOOL.codex, "openai"), "explorer.md")
    ).toBe(`name = "aidd-orchestrator-explorer"
description = "Reviews the work"
model = "gpt-6-luna"
model_reasoning_effort = "medium"
developer_instructions = "Review.\\n"
`);
  });

  it("gives the reviewer the smart model, prefixed by the provider where the host wants it", () => {
    expect(write(withAgentModels(TOOL.opencode, "mistral"), "reviewer.md")).toBe(`---
description: 'Reviews the work'
model: 'mistral/mistral-large-4#high'
mode: 'subagent'
---
Review.
`);
  });

  it("gives a Cursor agent the model of its role", () => {
    expect(write(withAgentModels(TOOL.cursor, "anthropic"), "reviewer.md")).toContain(
      "claude-opus-5-5"
    );
  });

  it("uses the host's own id for a model it names differently", () => {
    expect(write(withAgentModels(TOOL.copilot, "anthropic"), "validator.md")).toBe(`---
name: 'aidd-orchestrator-validator'
description: 'Reviews the work'
model: 'claude-haiku-5.5'
reasoningEffort: 'medium'
include-custom-instructions: true
---
Review.
`);
  });

  it("leaves an agent whose role is not listed, or that declares its own model, as written", () => {
    const contract = withAgentModels(TOOL.claude, "anthropic");
    const plain = plainContract(TOOL.claude);
    const pinned = "---\ndescription: d\nmodel: claude-opus-5-5\n---\nBody.\n";
    expect(write(contract, "planner.md")).toBe(write(plain, "planner.md"));
    expect(write(contract, "explorer.md", pinned)).toBe(write(plain, "explorer.md", pinned));
  });

  it("gives a Kilo agent a provider-prefixed model and the effort as its variant", () => {
    expect(write(withAgentModels(TOOL.kilo, "anthropic"), "explorer.md")).toBe(`---
description: 'Reviews the work'
model: 'anthropic/claude-haiku-5-5'
variant: 'medium'
mode: 'subagent'
---
Review.
`);
  });

  it("refuses a provider the host cannot run, and a host with no provider", () => {
    expect(() => withAgentModels(TOOL.codex, "mistral")).toThrow(
      'Provider "mistral" is not supported for "codex". Use: openai.'
    );
    expect(() => withAgentModels(TOOL.antigravity, "openai")).toThrow(
      'No agent provider is supported for "antigravity".'
    );
  });
});

describe("the main session's settings", () => {
  it.each([
    [TOOL.claude, "anthropic", { model: "claude-sonnet-5-5", effortLevel: "medium" }],
    // OpenCode's root `model` keeps no variant, so no effort is written.
    [TOOL.opencode, "mistral", { model: "mistral/mistral-large-4" }],
  ] as const)(
    "resolves %s / %s to the main session's tier model, in native settings",
    (host, provider, expected) => {
      expect(registeredAiProfile(host).agentModels()?.mainSettingsValues(provider)).toStrictEqual(
        expected
      );
    }
  );

  it.each([
    [TOOL.codex, "openai"],
    [TOOL.copilot, "openai"],
    [TOOL.cursor, "anthropic"],
    [TOOL.kilo, "mistral"],
  ] as const)("leaves %s without a file-based main model", (host, provider) => {
    expect(registeredAiProfile(host).agentModels()?.mainSettingsValues(provider)).toStrictEqual({});
  });
});

describe("a models section", () => {
  it("refuses a provider the model table does not define", () => {
    expect(() => new ModelsSection({ providers: ["bogus"] })).toThrow(
      '"bogus" is no provider AGENT_MODELS defines.'
    );
  });
});
