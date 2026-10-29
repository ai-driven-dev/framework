import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setAgentModel = vi.fn();

vi.mock("../../../src/runtime/wiring/framework.js", () => ({
  createDeps: vi.fn(async () => ({ setAgentModelUseCase: { execute: setAgentModel } })),
  createMenuDeps: vi.fn(),
}));

const { createDeps } = await import("../../../src/runtime/wiring/framework.js");
const { registerAgentsCommand } = await import("../../../src/presentation/commands/agents.js");

const PROJECT_ROOT = process.cwd();
const OTHER_PROJECTS = "Other projects on this machine pick it up at their next aidd update.";

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
  setAgentModel.mockResolvedValue({ mainSet: [], reinstalled: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function run(...args: string[]): Promise<string[]> {
  const program = new Command();
  program.exitOverride();
  program.option("--verbose");
  registerAgentsCommand(program);
  await program.parseAsync(["node", "aidd", "agents", ...args]);
  return written.join("").split("\n").slice(0, -1);
}

describe("aidd agents set-model", () => {
  it("records the provider for this project's agents and names nothing more", async () => {
    expect(await run("set-model", "mistral", "--ide", "opencode, kilo")).toEqual([
      "Agents for opencode, kilo run on mistral.",
      OTHER_PROJECTS,
    ]);
    expect(setAgentModel).toHaveBeenCalledWith({
      projectRoot: PROJECT_ROOT,
      hosts: ["opencode", "kilo"],
      provider: "mistral",
      main: false,
      scope: "project",
    });
    expect(errors).toEqual([]);
  });

  it("names the main models it set, warns about the hosts it could not, and lists the reinstalled plugins", async () => {
    setAgentModel.mockResolvedValue({ mainSet: ["claude"], reinstalled: ["aidd-dev", "aidd-pm"] });

    expect(
      await run("set-model", "anthropic", "--ide", "claude,cursor", "--main", "--global")
    ).toEqual([
      "Agents for claude, cursor run on anthropic.",
      OTHER_PROJECTS,
      "Main model set for claude.",
      "Reinstalled: aidd-dev, aidd-pm.",
    ]);
    expect(setAgentModel).toHaveBeenCalledWith(
      expect.objectContaining({ main: true, scope: "user" })
    );
    expect(errors.join("")).toBe(
      "Warning: No main-model setting at this scope for cursor; left unchanged.\n"
    );
  });

  it("refuses an unknown IDE before building anything", async () => {
    vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exited");
    });

    await expect(run("set-model", "openai", "--ide", "codex,vscode,zed")).rejects.toThrow("exited");

    expect(errors.join("")).toBe(
      "Error: Unknown IDE: vscode, zed. Use: claude, codex, copilot, opencode, cursor, kilo.\n"
    );
    expect(vi.mocked(createDeps)).not.toHaveBeenCalled();
  });
});

describe("aidd agents unset-model", () => {
  it("gives the agents back the session's model, with no warning for the main model", async () => {
    expect(await run("unset-model", "--ide", "claude")).toEqual([
      "Agents for claude run on the session's model.",
      OTHER_PROJECTS,
    ]);
    expect(setAgentModel).toHaveBeenCalledWith({
      projectRoot: PROJECT_ROOT,
      hosts: ["claude"],
      provider: undefined,
      main: false,
      scope: "project",
    });
    expect(errors).toEqual([]);
  });
});
