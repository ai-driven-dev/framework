import { describe, expect, it } from "vitest";
import { stringifyToml } from "../../../../../../src/contexts/tools/domain/profiles/codex/toml.js";
import {
  applyCodexAgentModelOverrides,
  captureCodexAgentModelOverride,
} from "../../../../../../src/contexts/tools/domain/profiles/codex/user-file-overrides.js";
import { InstallationFile } from "../../../../../../src/kernel/file.js";
import { DeterministicHasher } from "../../../../../../tests/helpers/ports/deterministic-hasher.js";

const generated = stringifyToml({
  name: "aidd-orchestrator-explorer",
  description: "Explore sources.",
  developer_instructions: "Report findings.",
});

describe("Codex agent model override migration", () => {
  it("captures only model settings when the rest matches canonical generated TOML", () => {
    const installed = stringifyToml({
      name: "aidd-orchestrator-explorer",
      description: "Explore sources.",
      developer_instructions: "Report findings.",
      model: "gpt-6-luna",
      model_reasoning_effort: "high",
    });

    expect(captureCodexAgentModelOverride(generated, installed)).toEqual({
      model: "gpt-6-luna",
      model_reasoning_effort: "high",
    });
  });

  it("preserves nonempty future effort values without a hard-coded allowlist", () => {
    const installed = stringifyToml({
      name: "aidd-orchestrator-explorer",
      description: "Explore sources.",
      developer_instructions: "Report findings.",
      model: "future-model-id",
      model_reasoning_effort: "future-effort-level",
    });
    expect(captureCodexAgentModelOverride(generated, installed)).toEqual({
      model: "future-model-id",
      model_reasoning_effort: "future-effort-level",
    });
  });

  it("accepts model edits when the rest matches the previous hash, even after source text changes", () => {
    const hasher = new DeterministicHasher();
    const previous = stringifyToml({
      name: "aidd-orchestrator-explorer",
      description: "Explore sources.",
      developer_instructions: "Previous instructions.",
    });
    const installed = stringifyToml({
      name: "aidd-orchestrator-explorer",
      description: "Explore sources.",
      developer_instructions: "Previous instructions.",
      model: "gpt-6-luna",
      model_reasoning_effort: "high",
    });
    expect(
      captureCodexAgentModelOverride(generated, installed, hasher.hash(previous).value, hasher)
    ).toEqual({ model: "gpt-6-luna", model_reasoning_effort: "high" });
  });

  it.each(["", "  "])("refuses blank model settings: %j", (effort) => {
    const installed = stringifyToml({
      name: "aidd-orchestrator-explorer",
      description: "Explore sources.",
      developer_instructions: "Report findings.",
      model_reasoning_effort: effort,
    });
    expect(captureCodexAgentModelOverride(generated, installed)).toBeNull();
  });

  it("refuses to restore a generated model value the user removed", () => {
    const hasher = new DeterministicHasher();
    const historical = stringifyToml({
      name: "aidd-orchestrator-explorer",
      description: "Explore sources.",
      developer_instructions: "Report findings.",
    });
    const next = stringifyToml({
      name: "aidd-orchestrator-explorer",
      description: "Explore sources.",
      developer_instructions: "Updated instructions.",
      model: "new-default",
    });
    expect(
      captureCodexAgentModelOverride(next, historical, hasher.hash(historical).value, hasher)
    ).toBeNull();
  });

  it.each([
    ["instructions", { developer_instructions: "Changed instructions." }],
    ["description", { description: "Changed description." }],
    ["unknown key", { extra: "value" }],
  ])("refuses a %s edit", (_label, changed) => {
    const installed = stringifyToml({
      name: "aidd-orchestrator-explorer",
      description: "Explore sources.",
      developer_instructions: "Report findings.",
      model: "gpt-6-luna",
      ...changed,
    });
    expect(captureCodexAgentModelOverride(generated, installed)).toBeNull();
  });

  it("refuses comments and noncanonical TOML rather than dropping them", () => {
    expect(
      captureCodexAgentModelOverride(
        generated,
        `# Keep this note\n${generated}model = "gpt-6-luna"\n`
      )
    ).toBeNull();
    expect(
      captureCodexAgentModelOverride(generated, `${generated}model = "gpt-6-luna"`)
    ).toBeNull();
  });

  it("applies recorded settings before hashing and preserves file metadata", () => {
    const hasher = new DeterministicHasher();
    const source = new InstallationFile({
      relativePath: "agents/aidd-orchestrator-explorer.toml",
      content: generated,
      hash: hasher.hash(generated),
      mergeStrategy: "framework-prime",
      frameworkPath: "plugins/aidd-orchestrator/agents/explorer.md",
    });
    const [result] = applyCodexAgentModelOverrides(
      [source],
      {
        [source.relativePath]: { model: "gpt-6-luna", model_reasoning_effort: "high" },
      },
      hasher
    );

    expect(result.content).toBe(
      stringifyToml({
        name: "aidd-orchestrator-explorer",
        description: "Explore sources.",
        developer_instructions: "Report findings.",
        model: "gpt-6-luna",
        model_reasoning_effort: "high",
      })
    );
    expect(result.hash).toEqual(hasher.hash(result.content));
    expect(result.mergeStrategy).toBe("framework-prime");
    expect(result.frameworkPath).toBe("plugins/aidd-orchestrator/agents/explorer.md");
  });
});
