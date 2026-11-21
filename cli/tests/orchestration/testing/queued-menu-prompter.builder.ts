/** A scripted menu prompter that answers each select in turn and records what every level offered. */
import { vi } from "vitest";
import type { ProjectSetupState } from "../../../src/contexts/installation/contract/project-setup-state.js";
import type { Prompter } from "../../../src/orchestration/ports/prompter.js";

export type SelectCall = [
  message: string,
  choices: Array<{ name: string; value: string; description?: string }>,
];

/** A project the installation reports as set up, or not. */
export function setUp(isSetUp: boolean): ProjectSetupState {
  return { isSetUp: () => Promise.resolve(isSetUp) };
}

export function makeQueuedPrompter(
  selectResponses: string[],
  inputResponses: string[] = []
): {
  prompter: Prompter;
  selectCalls: SelectCall[];
  inputMock: ReturnType<typeof vi.fn>;
} {
  let selectIdx = 0;
  let inputIdx = 0;
  const selectCalls: SelectCall[] = [];
  const inputMock = vi.fn().mockImplementation(() => {
    return Promise.resolve(inputResponses[inputIdx++] ?? "");
  });
  const prompter: Prompter = {
    resolveConflict: vi.fn(),
    resolveConflictBulk: vi.fn(),
    confirm: vi.fn(),
    input: inputMock,
    select: async (message, choices) => {
      selectCalls.push([message, choices.map((c) => ({ ...c, value: String(c.value) }))]);
      const val = selectResponses[selectIdx++];
      const match = choices.find((c) => String(c.value) === val);
      if (!match) throw new Error(`No choice with value "${val}"`);
      return match.value;
    },
    checkbox: vi.fn(),
  };
  return { prompter, selectCalls, inputMock };
}
