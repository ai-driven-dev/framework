import { describe, expect, it } from "vitest";
import type { ToolBuildContract } from "../../../../../src/contexts/tools/domain/build-contract.js";
import { withAgentModels } from "../../../../../src/contexts/tools/domain/formats/agent-models.js";
import { buildClaudeFlatContract } from "../../../../../src/contexts/tools/domain/profiles/claude/build.js";
import { buildCodexFlatContract } from "../../../../../src/contexts/tools/domain/profiles/codex/build.js";
import { buildCopilotFlatContract } from "../../../../../src/contexts/tools/domain/profiles/copilot/build.js";
import { buildKiloFlatContract } from "../../../../../src/contexts/tools/domain/profiles/kilo/build.js";
import { buildOpencodeFlatContract } from "../../../../../src/contexts/tools/domain/profiles/opencode/build.js";

const AGENT = `---
description: Reviews the work
---
Review.
`;

function write(contract: ToolBuildContract, fileName: string, content = AGENT): string {
  const agents = contract.artifacts.agents;
  if (!agents.supported) throw new Error("no agents");
  return agents.transform?.(content, "aidd-orchestrator", fileName) ?? content;
}

describe("withAgentModels()", () => {
  it("gives a light role the provider's light model and effort, in the host's keys", () => {
    expect(
      write(withAgentModels(buildCodexFlatContract(), "codex", "openai"), "explorer.md")
    ).toBe(`name = "aidd-orchestrator-explorer"
description = "Reviews the work"
model = "gpt-6-luna"
model_reasoning_effort = "medium"
developer_instructions = "Review.\\n"
`);
  });

  it("gives the reviewer the standard model, prefixed by the provider where the host wants it", () => {
    expect(
      write(withAgentModels(buildOpencodeFlatContract(), "opencode", "mistral"), "reviewer.md")
    ).toBe(`---
description: 'Reviews the work'
model: 'mistral/mistral-medium-latest#high'
mode: 'subagent'
---
Review.
`);
  });

  it("uses the host's own id for a model it names differently", () => {
    expect(
      write(withAgentModels(buildCopilotFlatContract(), "copilot", "anthropic"), "validator.md")
    ).toBe(`---
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
    const contract = withAgentModels(buildClaudeFlatContract(), "claude", "anthropic");
    const plain = buildClaudeFlatContract();
    const pinned = "---\ndescription: d\nmodel: claude-opus-5-5\n---\nBody.\n";
    expect(write(contract, "planner.md")).toBe(write(plain, "planner.md"));
    expect(write(contract, "explorer.md", pinned)).toBe(write(plain, "explorer.md", pinned));
  });

  it("gives a Kilo agent a provider-prefixed model and the effort as its variant", () => {
    expect(write(withAgentModels(buildKiloFlatContract(), "kilo", "anthropic"), "explorer.md"))
      .toBe(`---
description: 'Reviews the work'
model: 'anthropic/claude-haiku-5-5'
variant: 'medium'
mode: 'subagent'
---
Review.
`);
  });

  it("refuses a provider the host cannot run, and a host with no provider", () => {
    expect(() => withAgentModels(buildCodexFlatContract(), "codex", "mistral")).toThrow(
      'Provider "mistral" is not supported for "codex". Use: openai.'
    );
    expect(() => withAgentModels(buildCodexFlatContract(), "vscode", "openai")).toThrow(
      'No agent provider is supported for "vscode".'
    );
  });
});
