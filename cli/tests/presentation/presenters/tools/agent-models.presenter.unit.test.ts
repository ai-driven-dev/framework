import { describe, expect, it } from "vitest";
import {
  type AgentModelsReport,
  reportAgentModels,
} from "../../../../src/presentation/presenters/tools/agent-models.presenter.js";
import { CapturingOutput } from "../../../shared/testing/capturing-output.fake.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_TOOL,
  syntheticConfig,
  syntheticMixedCatalog,
} from "../../../shared/testing/synthetic-tool-id.builder.js";

const OPENAI_CONFIG = syntheticConfig("syntheticopenai", ["openai"]);
const OPENAI_TOOL = OPENAI_CONFIG.toolId;
const OPENAI_CATALOG = syntheticMixedCatalog([OPENAI_CONFIG]);

const NO_CHANGE = { reinstalled: [], changed: [], skipped: [] };

function reported(
  report: Pick<AgentModelsReport, "provider" | "hosts" | "main"> & { agentsOnly?: boolean }
): CapturingOutput {
  const output = new CapturingOutput(false);
  reportAgentModels({ output, catalog: OPENAI_CATALOG, ...report });
  return output;
}

describe("reporting agent models", () => {
  it("says, per host, what the main session and each agent now run on, and what it updated", () => {
    const output = reported({
      provider: "openai",
      hosts: [OPENAI_TOOL, SECOND_SYNTHETIC_TOOL],
      main: {
        reinstalled: ["aidd-orchestrator"],
        changed: [{ host: OPENAI_TOOL, path: "/home/.config/synthetic/settings.json" }],
        skipped: [],
      },
    });

    expect(output.lines).toEqual([
      "Models on openai, for every project on this machine:",
      `  ${OPENAI_TOOL} main session: gpt-6.1-terra, written in /home/.config/synthetic/settings.json`,
      `  ${OPENAI_TOOL} reviewer: gpt-6.1-sol (high)`,
      `  ${OPENAI_TOOL} explorer, executor, validator: gpt-6-luna (medium)`,
      `  ${SECOND_SYNTHETIC_TOOL} main session: not managed by aidd, still the IDE's choice`,
      `  ${SECOND_SYNTHETIC_TOOL} reviewer: gpt-6.1-sol (high)`,
      `  ${SECOND_SYNTHETIC_TOOL} explorer, executor, validator: gpt-6-luna (medium)`,
      "Agents updated: aidd-orchestrator.",
      `Other projects follow at their next install; to update the agents they already have, run \`aidd setup --ide ${OPENAI_TOOL},${SECOND_SYNTHETIC_TOOL} --provider openai\` there.`,
    ]);
  });

  it("gives the agents back the IDE's model when no provider is named", () => {
    const output = reported({
      provider: undefined,
      hosts: [SYNTHETIC_TOOL],
      main: { ...NO_CHANGE, changed: [{ host: SYNTHETIC_TOOL, path: "/old/synthetic.json" }] },
    });

    expect(output.lines).toEqual([
      `${SYNTHETIC_TOOL}: the agents run on the IDE's model again.`,
      `  ${SYNTHETIC_TOOL} main session: restored in /old/synthetic.json`,
      "Agents installed later get these models too.",
      `Other projects follow at their next install; to update the agents they already have, run \`aidd setup --ide ${SYNTHETIC_TOOL} --provider none\` there.`,
    ]);
  });

  it("does not claim a main session it could not write, and warns why", () => {
    const output = reported({
      provider: "openai",
      hosts: [SECOND_SYNTHETIC_TOOL],
      main: {
        reinstalled: [],
        changed: [{ host: SECOND_SYNTHETIC_TOOL, path: "/old/settings.json" }],
        skipped: [
          {
            host: SECOND_SYNTHETIC_TOOL,
            path: "/new/settings.json",
            reason: "it holds no JSON object",
          },
        ],
      },
    });

    expect(output.lines.filter((line) => line.includes("main session"))).toEqual([
      `${SECOND_SYNTHETIC_TOOL} main session left as it is in /new/settings.json: it holds no JSON object.`,
    ]);
    expect(output.at("warn")).toHaveLength(1);
  });

  describe("for the agents alone", () => {
    it("says each agent's model and that the main session is unchanged, with the same flag to repeat it", () => {
      const output = reported({
        agentsOnly: true,
        provider: "openai",
        hosts: [OPENAI_TOOL],
        main: { ...NO_CHANGE, reinstalled: ["aidd-orchestrator"] },
      });

      expect(output.lines).toEqual([
        "Models on openai, for every project on this machine; main session unchanged:",
        `  ${OPENAI_TOOL} reviewer: gpt-6.1-sol (high)`,
        `  ${OPENAI_TOOL} explorer, executor, validator: gpt-6-luna (medium)`,
        "Agents updated: aidd-orchestrator.",
        `Other projects follow at their next install; to update the agents they already have, run \`aidd setup --ide ${OPENAI_TOOL} --provider openai --agents-only\` there.`,
      ]);
    });

    it("gives the agents back the IDE's model without a word about the main session", () => {
      const output = reported({
        agentsOnly: true,
        provider: undefined,
        hosts: [SYNTHETIC_TOOL],
        main: {
          ...NO_CHANGE,
          changed: [{ host: SYNTHETIC_TOOL, path: "/home/.config/synthetic/settings.json" }],
        },
      });

      expect(output.lines).toEqual([
        `${SYNTHETIC_TOOL}: the agents run on the IDE's model again; main session unchanged.`,
        "Agents installed later get these models too.",
        `Other projects follow at their next install; to update the agents they already have, run \`aidd setup --ide ${SYNTHETIC_TOOL} --provider none --agents-only\` there.`,
      ]);
    });
  });
});
