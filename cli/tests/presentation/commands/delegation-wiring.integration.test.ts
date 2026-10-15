import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DelegationResolution } from "../../../src/contexts/framework/domain/delegation.js";
import { resolveHomeDir } from "../../../src/kernel/reading/home-dir.js";

const execute = vi.fn();
vi.mock("../../../src/runtime/wiring/framework.js", () => ({
  createDeps: vi.fn(async () => ({ resolveDelegationUseCase: { execute } })),
}));

const { createDeps } = await import("../../../src/runtime/wiring/framework.js");
const { registerDelegationCommand } = await import(
  "../../../src/presentation/commands/delegation.js"
);

const resolution: DelegationResolution = {
  task: "exploration",
  tool: "codex",
  configured: true,
  canonicalAgent: "aidd-dev:explorer",
  agent: { name: "personal-explorer", path: "/agents/explorer.toml", mode: "flat" },
  requested: { model: "chosen-model", effort: "high" },
  native: { model: "chosen-model", model_reasoning_effort: "high" },
  nativeSurface: "agent-configuration",
  effectiveRuntime: "unknown",
  diagnostics: ["The installed agent pins its own model."],
};
let written: string[];
let errors: string[];

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
  execute.mockResolvedValue(resolution);
});

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

async function run(...args: string[]): Promise<string> {
  const program = new Command().exitOverride().option("--verbose");
  registerDelegationCommand(program);
  await program.parseAsync(["node", "aidd", ...args]);
  return written.join("");
}

describe("aidd delegation resolve", () => {
  it("resolves the selected task and host in the current project and home", async () => {
    await run("--verbose", "delegation", "resolve", "exploration", "--tool", "codex");

    expect(createDeps).toHaveBeenCalledWith(process.cwd(), { verbose: true }, expect.anything());
    expect(execute).toHaveBeenCalledWith({
      projectRoot: process.cwd(),
      home: resolveHomeDir(),
      env: process.env,
      task: "exploration",
      tool: "codex",
    });
  });

  it("returns a machine-readable resolution without mixing in text or warnings", async () => {
    const output = await run("delegation", "resolve", "exploration", "--tool", "codex", "--json");

    expect(JSON.parse(output)).toEqual(resolution);
    expect(errors).toEqual([]);
  });

  it("shows the installed identity, native surface and diagnostics without claiming application", async () => {
    const output = await run("delegation", "resolve", "exploration", "--tool", "codex");

    expect(output).toContain("Agent: personal-explorer (/agents/explorer.toml)");
    expect(output).toContain(`Requested: ${JSON.stringify(resolution.requested)}`);
    expect(output).toContain(
      `Native suggestion (agent-configuration): ${JSON.stringify(resolution.native)}`
    );
    expect(output).toContain("Unspecified settings inherit. Effective runtime: unknown.");
    expect(errors.join("")).toContain("The installed agent pins its own model.");
  });

  it("keeps missing settings inherited without inventing an agent or native options", async () => {
    execute.mockResolvedValue({ ...resolution, configured: false, agent: undefined });

    const output = await run("delegation", "resolve", "exploration", "--tool", "codex");

    expect(output).toContain(
      "No configured suggestion for exploration; the caller keeps its role and native settings."
    );
    expect(output).toContain("Unspecified settings inherit. Effective runtime: unknown.");
    expect(output).not.toContain("Agent:");
    expect(output).not.toContain("Native suggestion");
    expect(errors).toEqual([]);
  });

  it("requires the host before attempting resolution", async () => {
    await expect(run("delegation", "resolve", "exploration")).rejects.toMatchObject({
      code: "commander.missingMandatoryOptionValue",
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("reports a resolution failure on stderr and exits unsuccessfully", async () => {
    execute.mockRejectedValue(new Error("The selected agent is unavailable"));
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exited");
    });

    await expect(run("delegation", "resolve", "exploration", "--tool", "codex")).rejects.toThrow(
      "exited"
    );
    expect(exit).toHaveBeenCalledWith(1);
    expect(errors.join("")).toContain("Error: The selected agent is unavailable");
    expect(written).toEqual([]);
  });
});
