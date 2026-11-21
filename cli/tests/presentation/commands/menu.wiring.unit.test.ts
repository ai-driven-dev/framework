import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { wireTools } from "../../../src/composition/tools.js";
import { BuildMenu } from "../../../src/orchestration/menu/build-menu.use-case.js";
import { MenuLoop } from "../../../src/orchestration/menu/menu-loop.use-case.js";
import { describeMessage } from "../../../src/presentation/errors/describe-message.presenter.js";
import { OutputAdapter } from "../../../src/presentation/terminal/output.adapter.js";
import { prompterAnswering } from "../../shared/testing/partial-ports.builder.js";

const loadManifest = vi.fn();
const promptSelect = vi.fn();
const promptConfirm = vi.fn();
const promptInput = vi.fn();
const spawn = vi.fn();
const question = vi.fn();
const close = vi.fn();

vi.mock("node:readline", () => ({
  default: { createInterface: vi.fn(() => ({ question, close })) },
}));

const { runMenuLoop } = await import("../../../src/presentation/commands/menu.js");
const { waitForEnter } = await import("../../../src/presentation/terminal/wait-for-enter.js");
const { resolveProjectRoot } = await import("../../../src/presentation/terminal/project-root.js");

const menuOf = vi.fn(() => {
  const prompter = prompterAnswering({
    select: promptSelect,
    confirm: promptConfirm,
    input: promptInput,
  });
  const projectSetup = { isSetUp: async () => (await loadManifest()) !== null };
  const menu = new BuildMenu(projectSetup, prompter, wireTools());
  return new MenuLoop(menu, { run: spawn }, { untilEnter: waitForEnter });
});

let written: string[] = [];
let errors: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  written = [];
  errors = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    written.push(String(chunk));
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    errors.push(String(chunk));
    return true;
  });
  question.mockImplementation((_prompt: string, callback: () => void) => {
    callback();
  });
  loadManifest.mockResolvedValue(null);
  promptConfirm.mockResolvedValue(false);
  spawn.mockResolvedValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

/** The loop only ever ends by exiting the process, so the spy has to unwind it. */
function exiting(): MockInstance<typeof process.exit> {
  return vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`exit ${String(code)}`);
  });
}

async function loopUntilExit(): Promise<void> {
  await expect(
    runMenuLoop(
      menuOf,
      resolveProjectRoot(),
      new OutputAdapter(false, (code) => process.exit(code), String, describeMessage)
    )
  ).rejects.toThrow(/^exit /);
}

describe("aidd with no argument - the menu loop", () => {
  it("greets with the banner, built off the project the process was started in", async () => {
    exiting();

    await loopUntilExit();

    expect(written[0].split("\n").at(-2)).toBe(" AI-Driven Development CLI");
    expect(vi.mocked(menuOf)).toHaveBeenCalledWith(resolveProjectRoot());
  });

  it("waits for a keypress after a command, so its output can be read", async () => {
    promptConfirm.mockResolvedValueOnce(true).mockResolvedValue(false);
    exiting();

    await loopUntilExit();

    expect(spawn).toHaveBeenCalledWith(["setup"]);
    expect(question.mock.calls[0][0]).toBe("\nPress ENTER to continue...");
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("leaves quietly when the person aborts a prompt with Ctrl-C", async () => {
    promptConfirm.mockRejectedValue(
      Object.assign(new Error("prompt aborted"), { name: "ExitPromptError" })
    );
    const exit = exiting();

    await loopUntilExit();

    expect(exit.mock.calls[0]).toEqual([0]);
    expect(errors).toEqual([]);
  });

  it("reports any other failure through the error handler, and fails the process", async () => {
    promptConfirm.mockRejectedValue(new Error("prompter is broken"));
    const exit = exiting();

    await loopUntilExit();

    expect(errors).toEqual(["Error: prompter is broken\n"]);
    expect(exit.mock.calls[0]).toEqual([1]);
  });
});
