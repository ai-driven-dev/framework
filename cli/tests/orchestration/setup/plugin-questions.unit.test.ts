import { describe, expect, it, vi } from "vitest";
import type { PluginSourceMatch } from "../../../src/contexts/distribution/contract/plugin-source-match.js";
import {
  askWhichMatch,
  type WhichMatchQuestion,
} from "../../../src/orchestration/setup/plugin-questions.js";
import { AmbiguousPluginMatchError } from "../../../src/shared/domain/errors.js";
import type { Prompter } from "../../../src/shared/ports/prompter.js";
import { ScriptedPrompter } from "../../shared/testing/scripted-prompter.fake.js";

function match(marketplaceName: string): PluginSourceMatch {
  return {
    marketplaceName,
    githubMarketplace: false,
    entry: {
      name: "aidd-dev",
      source: { kind: "local", path: "./aidd-dev" },
      recommended: false,
      strict: true,
    },
    source: { kind: "local", path: `/${marketplaceName}/aidd-dev` },
  };
}

const FIRST = match("first");
const SECOND = match("second");

function question(overrides: Partial<WhichMatchQuestion>): WhichMatchQuestion {
  return {
    pluginName: "aidd-dev",
    matches: [FIRST, SECOND],
    interactive: false,
    autoSelect: false,
    ...overrides,
  };
}

describe("askWhichMatch", () => {
  it("takes the only match without asking", async () => {
    const prompter = new ScriptedPrompter([]);

    await expect(askWhichMatch(prompter, question({ matches: [FIRST] }))).resolves.toBe(FIRST);
  });

  it("takes the first match without asking when it is told to", async () => {
    const prompter = new ScriptedPrompter([]);

    await expect(askWhichMatch(prompter, question({ autoSelect: true }))).resolves.toBe(FIRST);
  });

  it("names the marketplaces that carry it when nobody can choose", async () => {
    const prompter = new ScriptedPrompter([]);

    await expect(askWhichMatch(prompter, question({}))).rejects.toThrow(
      new AmbiguousPluginMatchError("aidd-dev", ["first", "second"])
    );
  });

  it.each([
    { autoSelect: false, interactive: false },
    { autoSelect: true, interactive: false },
  ])("has nothing to take from no match at all (%o)", async (flags) => {
    const prompter = new ScriptedPrompter([]);

    await expect(askWhichMatch(prompter, question({ ...flags, matches: [] }))).rejects.toThrow(
      AmbiguousPluginMatchError
    );
  });

  it("asks which marketplace when someone can answer", async () => {
    const select = vi.fn().mockResolvedValue(SECOND);
    const prompter: Prompter = {
      resolveConflict: vi.fn(),
      resolveConflictBulk: vi.fn(),
      confirm: vi.fn(),
      input: vi.fn(),
      select,
      checkbox: vi.fn(),
    };

    await expect(askWhichMatch(prompter, question({ interactive: true }))).resolves.toBe(SECOND);
    expect(select).toHaveBeenCalledOnce();
  });
});
