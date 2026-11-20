import { describe, expect, it } from "vitest";
import { ScriptedPrompter } from "./scripted-prompter.fake.js";

describe("ScriptedPrompter", () => {
  it("refuses a queued answer of another kind than the prompt asked", async () => {
    const prompter = new ScriptedPrompter([ScriptedPrompter.answer.conflict("keep")]);

    await expect(prompter.input("name?")).rejects.toThrow(
      'expected a "input" answer for "name?", the queue holds a "conflict"'
    );
  });
});
