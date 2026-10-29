import { resolve } from "node:path";
import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../../src/contexts/tools/domain/profiles/claude/profile.js";
import "../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import "../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import "../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import "../../../src/contexts/tools/domain/profiles/vscode/profile.js";
import { MarketplaceSourceMode } from "../../../src/contexts/distribution/domain/marketplace-source-mode.js";
import type { SetupFlow } from "../../../src/contexts/framework/domain/setup-flow.js";
import { AI_TOOL_IDS } from "../../../src/kernel/tool.js";

const resolveSourceIfNeeded = vi.fn();
const registerIfPresent = vi.fn();
const activation = vi.fn();
const setupTools = vi.fn();
const setupPluginsPrompt = vi.fn();
const setupToolsPrompt = vi.fn();
const detectContext = vi.fn();
const setupMachineScope = vi.fn();
const loadManifest = vi.fn();
const setAgentModel = vi.fn();

vi.mock("../../../src/runtime/wiring/framework.js", () => ({
  createDeps: vi.fn(async () => ({
    fs: {},
    manifestRepo: { load: loadManifest },
    setupMarketplaceRegistration: { resolveSourceIfNeeded, registerIfPresent },
    marketplaceSyncSettingsUseCase: { execute: activation },
    setupToolsUseCase: { execute: setupTools },
    setupPluginsPromptUseCase: { execute: setupPluginsPrompt },
    currentVersionProvider: { get: () => "5.2.2" },
    setupToolsPromptUseCase: { execute: setupToolsPrompt },
    projectContextDetector: { execute: detectContext },
    setupMachineScopeUseCase: { execute: setupMachineScope },
    setAgentModelUseCase: { execute: setAgentModel },
  })),
  createMenuDeps: vi.fn(),
}));

const { createDeps } = await import("../../../src/runtime/wiring/framework.js");
const { registerSetupCommand } = await import("../../../src/presentation/commands/setup.js");

const PROJECT_ROOT = process.cwd();

let written: string[] = [];
let errors: string[] = [];

function pretendTerminal(isTTY: boolean): void {
  Object.defineProperty(process.stdout, "isTTY", { value: isTTY, configurable: true });
}

function builtFlow(): SetupFlow {
  return resolveSourceIfNeeded.mock.calls[0][0] as SetupFlow;
}

beforeEach(() => {
  vi.clearAllMocks();
  written = [];
  errors = [];
  pretendTerminal(false);
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    written.push(String(chunk));
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    errors.push(String(chunk));
    return true;
  });
  loadManifest.mockResolvedValue({});
  setAgentModel.mockResolvedValue({ mainSet: [], reinstalled: [] });
  resolveSourceIfNeeded.mockResolvedValue(undefined);
  registerIfPresent.mockResolvedValue(undefined);
  activation.mockResolvedValue({ binaryMissing: [], errors: [] });
  setupTools.mockResolvedValue({ results: [] });
  setupPluginsPrompt.mockResolvedValue(undefined);
  setupToolsPrompt.mockResolvedValue({ aiTools: ["claude"], ideTools: [] });
  detectContext.mockResolvedValue({ describe: () => "a TypeScript project" });
  setupMachineScope.mockResolvedValue({
    kind: "up-to-date",
    install: { results: [] },
    activation: { binaryMissing: [], errors: [] },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

async function run(...args: string[]): Promise<string[]> {
  const program = new Command();
  program.exitOverride();
  program.option("--verbose");
  registerSetupCommand(program);
  await program.parseAsync(["node", "aidd", "setup", ...args]);
  return written.join("").split("\n").slice(0, -1);
}

describe("aidd setup — the flow a scripted run builds", () => {
  it("names the tools it was given, installs no plugin, and registers the default source", async () => {
    expect(await run("--ai", "claude")).toEqual(["Project is up to date."]);
    expect({ ...builtFlow() }).toEqual({
      projectRoot: PROJECT_ROOT,
      source: undefined,
      aiTools: ["claude"],
      ideTools: [],
      pluginMode: "none",
      pluginNames: [],
      interactive: false,
      force: false,
      registerDefaultMarketplace: true,
      scope: "project",
    });
    expect(setupTools).toHaveBeenCalledWith({
      projectRoot: PROJECT_ROOT,
      aiTools: ["claude"],
      ideTools: [],
      force: false,
      version: "5.2.2",
    });
  });

  it("expands the all keyword to every tool of that category", async () => {
    await run("--ai", "all");

    expect(builtFlow().aiTools).toEqual([...AI_TOOL_IDS]);
  });

  it("carries a named plugin list, and its mode, into the plugin prompt", async () => {
    await run("--ai", "claude", "--plugins", "aidd-dev,aidd-pm");

    expect(builtFlow().pluginMode).toBe("named");
    expect(setupPluginsPrompt).toHaveBeenCalledWith({
      projectRoot: PROJECT_ROOT,
      mode: "named",
      pluginNames: ["aidd-dev", "aidd-pm"],
      interactive: false,
    });
  });

  it("asks for no plugin at all when the default marketplace is refused", async () => {
    await run("--ai", "claude", "--no-default-marketplace");

    expect(builtFlow().registerDefaultMarketplace).toBe(false);
    expect(setupPluginsPrompt).not.toHaveBeenCalled();
  });

  it("resolves a local source against the working directory", async () => {
    await run("--source", "local", "--path", "vendor/framework", "--ai", "claude");

    expect(builtFlow().source).toEqual(MarketplaceSourceMode.local(resolve("vendor/framework")));
  });

  it("carries the release tag a remote source was pinned to", async () => {
    await run("--source", "remote", "--release", "v1.2.3", "--ai", "claude");

    expect(builtFlow().source).toEqual(MarketplaceSourceMode.remote(undefined, "v1.2.3"));
  });

  it("hands a user scope to the machine-wide setup alone", async () => {
    await run("--ai", "claude", "--scope", "user");

    const flow = setupMachineScope.mock.calls[0][0] as SetupFlow;
    expect(flow.scope).toBe("user");
    expect(setupTools).not.toHaveBeenCalled();
    expect(resolveSourceIfNeeded).not.toHaveBeenCalled();
  });
});

describe("aidd setup — the agents' provider", () => {
  it("records the provider for the agent hosts it installs, before the install builds", async () => {
    await run("--ide", "opencode,vscode", "--provider", "mistral", "--main");

    expect(setAgentModel).toHaveBeenCalledWith({
      projectRoot: PROJECT_ROOT,
      hosts: ["opencode"],
      provider: "mistral",
      main: true,
      scope: "project",
    });
    expect(setAgentModel.mock.invocationCallOrder[0]).toBeLessThan(
      resolveSourceIfNeeded.mock.invocationCallOrder[0]
    );
  });

  it("names the main models it set, and warns about the hosts it could not", async () => {
    setAgentModel.mockResolvedValue({ mainSet: ["opencode"], reinstalled: [] });

    const lines = await run("--ide", "opencode,kilo", "--provider", "mistral", "--main");

    expect(lines.slice(0, 3)).toEqual([
      "Agents for opencode, kilo run on mistral.",
      "Other projects on this machine pick it up at their next aidd update.",
      "Main model set for opencode.",
    ]);
    expect(errors.join("")).toContain(
      "Warning: No main-model setting at this scope for kilo; left unchanged.\n"
    );
  });

  it("gives the agents back the session's model with none, without a main-model warning", async () => {
    const lines = await run("--ide", "opencode", "--provider", "none", "--main");

    expect(setAgentModel).toHaveBeenCalledWith(
      expect.objectContaining({ hosts: ["opencode"], provider: undefined, main: true })
    );
    expect(lines[0]).toBe("Agents for opencode run on the session's model.");
    expect(errors.join("")).not.toContain("main-model");
  });

  it.each([
    [["--ide", "claude,codex", "--provider", "openai"], 'not supported for "claude"'],
    [["--global", "--ide", "claude,vscode", "--provider", "anthropic", "--main"], "vscode"],
    [["--ide", "claude", "--main"], "--main needs --provider"],
  ])("refuses %j before building or writing anything", async (args, message) => {
    vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exited");
    });

    await expect(run(...args)).rejects.toThrow("exited");

    expect(errors.join("")).toContain(message);
    expect(vi.mocked(createDeps)).not.toHaveBeenCalled();
    expect(setAgentModel).not.toHaveBeenCalled();
  });
});

describe("aidd setup — a person at a terminal", () => {
  it("greets, names what it detected, and ends with what to do next", async () => {
    pretendTerminal(true);
    setupTools.mockResolvedValue({
      results: [{ toolId: "claude", fileCount: 9, files: [], skipped: false, warnings: [] }],
    });

    expect(await run()).toEqual([
      "",
      "AI-Driven Development setup",
      "Wires your AI tools, registers the framework marketplace, installs plugins.",
      "Press Ctrl-C any time to abort.",
      "",
      "Detected: a TypeScript project.",
      "Project is up to date.",
      "Installed claude (9 files)",
      "",
      "Next steps:",
      "  aidd doctor             # verify drift",
      "  aidd marketplace list   # see registered marketplaces",
      "  aidd plugin install     # add plugins",
      "  aidd --help             # explore commands",
    ]);
    expect(builtFlow().interactive).toBe(true);
    expect(builtFlow().pluginMode).toBe("interactive");
  });

  it("stops being interactive as soon as one scripting flag is given", async () => {
    pretendTerminal(true);

    const lines = await run("--yes");

    expect(builtFlow().interactive).toBe(false);
    expect(builtFlow().pluginMode).toBe("none");
    expect(lines).toEqual(["Project is up to date."]);
  });

  it("hands this run's verbosity to the rendering, not only to the graph", async () => {
    setupTools.mockResolvedValue({
      results: [
        {
          toolId: "claude",
          fileCount: 1,
          files: [{ relativePath: "CLAUDE.md" }],
          skipped: false,
          warnings: [],
        },
      ],
    });

    await run("--verbose", "--ai", "claude");

    expect(errors).toEqual(["[verbose] Tool: claude\n", "[verbose]   + CLAUDE.md\n"]);
  });
});

describe("aidd setup — every flag that makes a run a scripted one", () => {
  it.each([
    [["--source", "remote"]],
    [["--release", "v1.2.3"]],
    [["--ai", "claude"]],
    [["--ide", "vscode"]],
    [["--plugins", "none"]],
    [["--yes"]],
  ])("stops prompting on its own once %j is given", async (args) => {
    pretendTerminal(true);

    await run(...args);

    expect(builtFlow().interactive).toBe(false);
  });

  it("keeps the detection quiet when nothing about the project was detected", async () => {
    pretendTerminal(true);
    detectContext.mockResolvedValue(undefined);

    const lines = await run();

    expect(lines).not.toContain("Detected: a TypeScript project.");
  });

  it("leaves the drift check out of the next steps when nothing was installed", async () => {
    pretendTerminal(true);

    const lines = await run();

    expect(lines).not.toContain("  aidd doctor             # verify drift");
    expect(lines).toContain("  aidd marketplace list   # see registered marketplaces");
  });
});

describe("aidd setup — what it refuses and what it reports", () => {
  it.each(["all", "recommended", "aidd-dev"])(
    "refuses user-scope plugin mode %s before building dependencies",
    async (plugins) => {
      const exit = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("exited");
      });

      await expect(run("--scope", "user", "--ai", "claude", "--plugins", plugins)).rejects.toThrow(
        "exited"
      );

      expect(errors.join("")).toBe(
        "Error: --scope user has no manifest entry a plugin can be recorded against yet, so " +
          "--plugins has nothing to enable. Drop --plugins, or run `aidd plugin install` " +
          "separately at project scope.\n"
      );
      expect(exit).toHaveBeenCalledWith(1);
      expect(vi.mocked(createDeps)).not.toHaveBeenCalled();
      expect(written).toEqual([]);
    }
  );

  it.each([
    { args: [], cause: "with no --ide", remedy: "Pass `--ide <ids>`" },
    {
      args: ["--ide", "claude,vscode"],
      cause: "an editor (vscode)",
      remedy: "Drop it from --ide",
    },
    {
      args: ["--ide", "opencode"],
      cause: "none exists for: opencode",
      remedy: "Drop them from --ide",
    },
  ])("renders global validation for $cause before building dependencies", async (test) => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exited");
    });

    await expect(run("--global", ...test.args)).rejects.toThrow("exited");

    expect(errors.join("")).toContain(test.cause);
    expect(errors.join("")).toContain(test.remedy);
    expect(errors.join("")).not.toMatch(/UserScope\w+Error|\n\s+at /);
    expect(exit).toHaveBeenCalledWith(1);
    expect(vi.mocked(createDeps)).not.toHaveBeenCalled();
    expect(written).toEqual([]);
  });

  it("refuses a local source with nowhere to read it from", async () => {
    vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exited");
    });

    await expect(run("--source", "local")).rejects.toThrow("exited");

    expect(errors[0]).toBe("Error: --source local requires --path <dir>\n");
    expect(vi.mocked(createDeps)).not.toHaveBeenCalled();
  });

  it("refuses a scope it does not know", async () => {
    vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exited");
    });

    await expect(run("--scope", "machine")).rejects.toThrow("exited");

    expect(errors[0]).toBe('Error: Invalid --scope "machine" — expected "project" or "user".\n');
    expect(vi.mocked(createDeps)).not.toHaveBeenCalled();
  });

  it("refuses an IDE id offered as an AI tool, before building anything", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exited");
    });

    await expect(run("--ai", "vscode")).rejects.toThrow("exited");

    expect(exit).toHaveBeenCalledWith(1);
    expect(vi.mocked(createDeps)).not.toHaveBeenCalled();
  });

  it("names a refused activation and fails the process", async () => {
    activation.mockResolvedValue({
      binaryMissing: [],
      errors: [{ scope: "claude", message: "claude CLI refused" }],
    });
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exited");
    });

    await expect(run("--ai", "claude")).rejects.toThrow("exited");

    expect(errors.join("")).toBe(
      "Warning: [claude] claude CLI refused\nError: Sync failed for: claude. See the warnings above.\n"
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("names a failed install on stderr and fails the process", async () => {
    setupTools.mockRejectedValue(new Error("assets are missing"));
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exited");
    });

    await expect(run("--ai", "claude")).rejects.toThrow("exited");

    expect(errors.join("")).toBe("Error: assets are missing\n");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("builds the graph for this project at this run's verbosity", async () => {
    await run("--verbose", "--ai", "claude");

    expect(vi.mocked(createDeps)).toHaveBeenCalledWith(
      PROJECT_ROOT,
      { verbose: true },
      expect.anything()
    );
  });
});

describe("aidd setup — the help surface", () => {
  function setupCommand(): Command {
    const program = new Command();
    registerSetupCommand(program);
    const setup = program.commands.find((command) => command.name() === "setup");
    if (setup === undefined) throw new Error("setup command was not registered");
    return setup;
  }

  it("describes itself against the command that acts on the framework alone", () => {
    expect(setupCommand().description()).toBe(
      "Set up or update the project to a correct state — bootstraps the whole project (marketplace, framework, tools, plugins); see `framework install`, which acts on the framework alone"
    );
  });

  it("offers a source, one tool list, a plugin mode, a scope, a provider, and its switches", () => {
    const visible = setupCommand().options.filter((option) => !option.hidden);
    expect(visible.map((option) => [option.flags, option.description])).toEqual([
      ["--source <mode>", "Framework source: remote or local"],
      ["--path <dir>", "Absolute path to local framework (required with --source local)"],
      ["--release <tag>", "Marketplace release tag to fetch (e.g., v1.2.3)"],
      ["--ide <ids>", "Comma-separated tool IDs, or 'all' (e.g., claude,vscode or all)"],
      ["--plugins <mode>", "Plugin install mode: none | all | recommended | comma-separated names"],
      [
        "--no-default-marketplace",
        "Skip auto-registering aidd-framework (no source prompt, no plugin install)",
      ],
      ["--yes", "Accept defaults without prompting"],
      [
        "--global",
        "register the shared framework source and supported tools machine-wide instead of " +
          "installing into this project; see the requirements below",
      ],
      [
        "--provider <provider>",
        "Run each tool's agents on this provider's model for their role (openai, anthropic, mistral), or none for the session's model",
      ],
      ["--main", "with --provider, also run the main session on its smart model"],
    ]);
    expect(
      setupCommand()
        .options.filter((option) => option.hidden)
        .map((option) => option.flags)
    ).toEqual(["--ai <ids>", "--scope <scope>"]);
  });
});
