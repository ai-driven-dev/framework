import { describe, expect, it } from "vitest";
import {
  CLAUDE_SETTINGS,
  CONFIG,
  OPENCODE_SETTINGS,
  PROJECT,
  setup,
} from "../testing/agent-models.builder.js";
import { HOST } from "../testing/synthetic-hosts.builder.js";

describe("resetting agent models", () => {
  it("resets the machine: restores every main session it changed and forgets the providers", async () => {
    const { fs, useCase, reset: resetUseCase } = setup();
    fs.setFile(CLAUDE_SETTINGS, '{\n  "model": "opus"\n}\n');
    const base = { projectRoot: PROJECT, scope: "project" as const };
    await useCase.execute({ ...base, hosts: [HOST.claude, HOST.mcp], provider: "anthropic" });

    const preview = await resetUseCase.execute({ dryRun: true });
    expect(preview.providers).toStrictEqual([HOST.claude, HOST.mcp]);
    expect(preview.changed.map(({ host }) => host)).toStrictEqual([HOST.claude, HOST.mcp]);
    expect(fs.getFile(CLAUDE_SETTINGS)).toContain("claude-sonnet-5-5");

    await resetUseCase.execute({ dryRun: false });
    expect(fs.getFile(CLAUDE_SETTINGS)).toBe('{\n  "model": "opus"\n}\n');
    expect(fs.has(OPENCODE_SETTINGS)).toBe(false);
    expect(fs.has(`${CONFIG}/agent-models.json`)).toBe(false);
    expect(fs.has(`${CONFIG}/main-model.json`)).toBe(false);
  });

  it("forgets the provider on reset even when a settings file cannot be restored", async () => {
    const { fs, useCase, reset: resetUseCase } = setup();
    await useCase.execute({
      projectRoot: PROJECT,
      scope: "project",
      hosts: [HOST.claude],
      provider: "anthropic",
    });
    fs.setFile(CLAUDE_SETTINGS, "{ broken");

    const reset = await resetUseCase.execute({ dryRun: false });

    expect(reset.skipped.map(({ host }) => host)).toStrictEqual([HOST.claude]);
    expect(fs.has(`${CONFIG}/agent-models.json`)).toBe(false);
  });
});
