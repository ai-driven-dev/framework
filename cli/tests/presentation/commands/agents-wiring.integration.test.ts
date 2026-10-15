import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { agentIdeNames } from "../../../src/contexts/tools/domain/formats/agent-models.js";

const install = vi.fn();
const remove = vi.fn();

vi.mock("../../../src/runtime/wiring/framework.js", () => ({
  createDeps: vi.fn(async () => ({ manageAgentsUseCase: { install, remove } })),
}));

const { createDeps } = await import("../../../src/runtime/wiring/framework.js");
const { registerAgentsCommand } = await import("../../../src/presentation/commands/agents.js");

let written: string[];
let errors: string[];

beforeEach(() => {
  vi.clearAllMocks();
  install.mockResolvedValue(4);
  remove.mockResolvedValue(2);
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
});

afterEach(() => vi.restoreAllMocks());

async function run(...args: string[]): Promise<string> {
  const program = new Command();
  program.exitOverride().option("--verbose");
  registerAgentsCommand(program);
  await program.parseAsync(["node", "aidd", ...args]);
  return written.join("");
}

describe("explicit agent command routing", () => {
  it.each(["install", "remove"])("makes %s selections discoverable in help", (action) => {
    const program = new Command();
    registerAgentsCommand(program);
    const command = program.commands[0]?.commands.find((entry) => entry.name() === action);
    const words = new Set(command?.helpInformation().match(/[\w-]+/g));
    const choices = [...agentIdeNames(), ...(action === "install" ? ["openai", "anthropic"] : [])];
    for (const choice of choices) expect(words.has(choice), choice).toBe(true);
  });

  it.each([
    ["codex", "openai", "codex"],
    ["claude-code", "anthropic", "claude"],
  ])("passes %s and the chosen provider to installation", async (ide, provider, host) => {
    expect(await run("agents", "install", "--ide", ide, "--provider", provider)).toBe(
      `4 agent files installed for ${ide}.\n`
    );
    expect(install).toHaveBeenCalledExactlyOnceWith({ projectRoot: process.cwd(), host, provider });
    expect(remove).not.toHaveBeenCalled();
  });

  it("removes only the selected IDE's agents without selecting a provider", async () => {
    expect(await run("agents", "remove", "--ide", "codex")).toBe(
      "2 agent files removed for codex.\n"
    );
    expect(remove).toHaveBeenCalledExactlyOnceWith({ projectRoot: process.cwd(), host: "codex" });
    expect(install).not.toHaveBeenCalled();
  });

  it.each(["install", "remove"])("passes verbosity to %s dependencies", async (action) => {
    await run(
      "--verbose",
      "agents",
      action,
      "--ide",
      "codex",
      ...(action === "install" ? ["--provider", "openai"] : [])
    );
    expect(createDeps).toHaveBeenCalledExactlyOnceWith(
      process.cwd(),
      { verbose: true },
      expect.anything()
    );
  });

  it.each([["install", "--provider", "openai"], ["install", "--ide", "codex"], ["remove"]])(
    "refuses missing selection before %s runs",
    async (...args) => {
      await expect(run("agents", ...args)).rejects.toThrow("required option");
      expect(createDeps).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["install", "--ide", "codex", "--provider", "other"],
    ["install", "--ide", "other", "--provider", "openai"],
    ["remove", "--ide", "other"],
  ])("refuses unsupported selection before %s runs", async (...args) => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exited");
    });
    await expect(run("agents", ...args)).rejects.toThrow("exited");
    expect(exit).toHaveBeenCalledWith(1);
    expect(errors.join("")).toMatch(/not supported|Unsupported agent provider/);
    expect(createDeps).not.toHaveBeenCalled();
  });

  it.each(["install", "remove"])("reports %s failures and exits unsuccessfully", async (action) => {
    (action === "install" ? install : remove).mockRejectedValue(new Error("agent was modified"));
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exited");
    });
    await expect(
      run(
        "agents",
        action,
        "--ide",
        "codex",
        ...(action === "install" ? ["--provider", "openai"] : [])
      )
    ).rejects.toThrow("exited");
    expect(exit).toHaveBeenCalledWith(1);
    expect(errors.join("")).toBe("Error: agent was modified\n");
  });
});
