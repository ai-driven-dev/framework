import { describe, expect, it } from "vitest";
import { resolveRestoreDecision } from "../../../../../src/contexts/installation/application/restore/resolve-restore-decision.js";
import { InputRequiredError } from "../../../../../src/shared/domain/errors.js";
import { ScriptedPrompter } from "../../../../shared/testing/scripted-prompter.js";

const PATH = "a.md";

function neverAsked(): ScriptedPrompter {
  return new ScriptedPrompter([]);
}

describe("resolveRestoreDecision", () => {
  it("restores a deleted file without asking, whatever the mode", async () => {
    const prompter = neverAsked();

    const keep = await resolveRestoreDecision(prompter, {
      relativePath: PATH,
      reason: "deleted",
      force: false,
      interactive: false,
    });

    expect(keep).toBe(false);
  });

  it("refuses a modified file when it can neither force nor ask", async () => {
    const prompter = neverAsked();

    await expect(
      resolveRestoreDecision(prompter, {
        relativePath: PATH,
        reason: "modified",
        force: false,
        interactive: false,
      })
    ).rejects.toThrow(
      new InputRequiredError("Use --force to overwrite modified files in non-interactive mode.")
    );
  });

  it("asks about a modified file when it may ask but not force", async () => {
    const prompter = new ScriptedPrompter([ScriptedPrompter.answer.conflict("keep")]);

    const keep = await resolveRestoreDecision(prompter, {
      relativePath: PATH,
      reason: "modified",
      force: false,
      interactive: true,
    });

    expect(keep).toBe(true);
  });

  it("overwrites a modified file without asking when forced, even where it could ask", async () => {
    const prompter = neverAsked();

    const keep = await resolveRestoreDecision(prompter, {
      relativePath: PATH,
      reason: "modified",
      force: true,
      interactive: true,
    });

    expect(keep).toBe(false);
  });

  it("overwrites a modified file without asking when forced with no one to ask", async () => {
    const prompter = neverAsked();

    const keep = await resolveRestoreDecision(prompter, {
      relativePath: PATH,
      reason: "modified",
      force: true,
      interactive: false,
    });

    expect(keep).toBe(false);
  });
});
