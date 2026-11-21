import { describe, expect, it } from "vitest";
import {
  type AgentModelsReport,
  reportAgentModels,
} from "../../../src/presentation/display/agent-models-display.js";
import { CapturingOutput } from "../../shared/testing/capturing-output.fake.js";
import { registeredCatalog } from "../../shared/testing/catalog-of.builder.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";

const NO_CHANGE = { reinstalled: [], changed: [], skipped: [] };

function reported(report: Pick<AgentModelsReport, "provider" | "hosts" | "main">): CapturingOutput {
  const output = new CapturingOutput(false);
  reportAgentModels({ output, catalog: registeredCatalog(), ...report });
  return output;
}

describe("reportAgentModels", () => {
  it("says, per host, what the main session and each agent now run on, and what it updated", () => {
    const output = reported({
      provider: "mistral",
      hosts: [TOOL.opencode, TOOL.kilo],
      main: {
        reinstalled: ["aidd-orchestrator"],
        changed: [{ host: TOOL.opencode, path: "/home/.config/opencode/opencode.json" }],
        skipped: [],
      },
    });

    expect(output.lines).toEqual([
      "Models on mistral, for every project on this machine:",
      "  opencode main session: mistral/mistral-large-4, written in /home/.config/opencode/opencode.json",
      "  opencode reviewer: mistral/mistral-large-4 (high)",
      "  opencode explorer, executor, validator: mistral/mistral-small-latest (high)",
      "  kilo main session: not managed by aidd, still the IDE's choice",
      "  kilo reviewer: mistral/mistral-large-4 (high)",
      "  kilo explorer, executor, validator: mistral/mistral-small-latest (high)",
      "Agents updated: aidd-orchestrator.",
      "Other projects follow at their next install; to update the agents they already have, run `aidd setup --ide opencode,kilo --provider mistral` there.",
    ]);
  });

  it("gives the agents back the IDE's model when no provider is named", () => {
    const output = reported({
      provider: undefined,
      hosts: [TOOL.opencode],
      main: { ...NO_CHANGE, changed: [{ host: TOOL.opencode, path: "/old/opencode.json" }] },
    });

    expect(output.lines).toEqual([
      "opencode: the agents run on the IDE's model again.",
      "  opencode main session: restored in /old/opencode.json",
      "Agents installed later get these models too.",
      "Other projects follow at their next install; to update the agents they already have, run `aidd setup --ide opencode --provider none` there.",
    ]);
  });

  it("does not claim a main session it could not write, and warns why", () => {
    const output = reported({
      provider: "anthropic",
      hosts: [TOOL.claude],
      main: {
        reinstalled: [],
        changed: [{ host: TOOL.claude, path: "/old/settings.json" }],
        skipped: [
          { host: TOOL.claude, path: "/new/settings.json", reason: "it holds no JSON object" },
        ],
      },
    });

    expect(output.lines.filter((line) => line.includes("main session"))).toEqual([
      "claude main session left as it is in /new/settings.json: it holds no JSON object.",
    ]);
    expect(output.at("warn")).toHaveLength(1);
  });
});
