import { resolve } from "node:path";
import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  localFrameworkSource,
  remoteFrameworkSource,
} from "../../../src/contexts/distribution/contract/framework-source.js";
import { InitProject } from "../../../src/contexts/installation/application/init-project.use-case.js";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.use-case.js";
import type { SetupFlow } from "../../../src/orchestration/domain/setup-flow.model.js";
import { RunSetup } from "../../../src/orchestration/setup/run-setup.use-case.js";
import { bindOutput } from "../../../src/presentation/controllers/global-options.controller.js";
import { ExitRequested } from "../../shared/testing/capturing-output.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { processOutputFactory } from "../../shared/testing/output-factory.builder.js";
import { parseToExit } from "../../shared/testing/parse-to-exit.builder.js";
import { manifestRepositoryLoading } from "../../shared/testing/partial-ports.builder.js";
import {
  ACTIVATED_SYNTHETIC_CONFIG,
  ACTIVATED_SYNTHETIC_TOOL,
} from "../../shared/testing/synthetic-native-tool.builder.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_IDE_TOOL,
  SYNTHETIC_TOOL,
  syntheticMixedCatalog,
} from "../../shared/testing/synthetic-tool-id.builder.js";

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

const CATALOG = syntheticMixedCatalog([ACTIVATED_SYNTHETIC_CONFIG]);

const createDeps = vi.fn(async () => {
  const fs = new InMemoryFileAdapter();
  return {
    runSetup: new RunSetup(
      {
        resolveSource: { execute: resolveSourceIfNeeded },
        register: registerIfPresent,
        installTools: { execute: setupTools },
        syncSettings: activation,
        version: { get: () => "5.2.2" },
        detectContext: { execute: detectContext },
        machineScope: { execute: setupMachineScope },
      },
      { plugins: setupPluginsPrompt, tools: setupToolsPrompt },
      new InitProject(
        {
          fs,
          manifestRepo: manifestRepositoryLoading(loadManifest),
          updateGitignore: new UpdateGitignore(fs),
        },
        CATALOG
      )
    ),
    setAgentModels: { execute: setAgentModel, reset: vi.fn() },
  };
});

const { registerSetupCommand } = await import(
  "../../../src/presentation/controllers/setup.controller.js"
);

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
  setAgentModel.mockResolvedValue({ reinstalled: [], changed: [], skipped: [] });
  resolveSourceIfNeeded.mockResolvedValue(undefined);
  registerIfPresent.mockResolvedValue(undefined);
  activation.mockResolvedValue({ binaryMissing: [], errors: [], failed: false });
  setupTools.mockResolvedValue({ results: [] });
  setupPluginsPrompt.mockResolvedValue(undefined);
  setupToolsPrompt.mockResolvedValue({ aiTools: [SYNTHETIC_TOOL], ideTools: [] });
  detectContext.mockResolvedValue({ describe: () => "a TypeScript project" });
  setupMachineScope.mockResolvedValue({
    kind: "up-to-date",
    install: { results: [] },
    activation: { binaryMissing: [], errors: [], failed: false },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

async function run(...args: string[]): Promise<string[]> {
  const program = new Command();
  bindOutput(program, processOutputFactory());
  program.exitOverride();
  program.option("--verbose");
  registerSetupCommand(program, CATALOG, createDeps);
  await parseToExit(program, ["node", "aidd", "setup", ...args]);
  return written.join("").split("\n").slice(0, -1);
}

describe("aidd setup - the flow a scripted run builds", () => {
  it("names the tools it was given, installs no plugin, and registers the default source", async () => {
    expect(await run("--ai", SYNTHETIC_TOOL)).toEqual(["Project is up to date."]);
    expect({ ...builtFlow() }).toEqual({
      projectRoot: PROJECT_ROOT,
      source: undefined,
      aiTools: [SYNTHETIC_TOOL],
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
      aiTools: [SYNTHETIC_TOOL],
      ideTools: [],
      force: false,
      version: "5.2.2",
    });
  });

  it("expands the all keyword to every tool of that category", async () => {
    await run("--ai", "all");

    expect(builtFlow().aiTools).toEqual([...CATALOG.idsInCanonicalOrder("ai")]);
  });

  it("carries a named plugin list, and its mode, into the plugin prompt", async () => {
    await run("--ai", SYNTHETIC_TOOL, "--plugins", "aidd-dev,aidd-pm");

    expect(builtFlow().pluginMode).toBe("named");
    expect(setupPluginsPrompt).toHaveBeenCalledWith({
      projectRoot: PROJECT_ROOT,
      mode: "named",
      pluginNames: ["aidd-dev", "aidd-pm"],
      interactive: false,
    });
  });

  it("asks for no plugin at all when the default marketplace is refused", async () => {
    await run("--ai", SYNTHETIC_TOOL, "--no-default-marketplace");

    expect(builtFlow().registerDefaultMarketplace).toBe(false);
    expect(setupPluginsPrompt).not.toHaveBeenCalled();
  });

  it("resolves a local source against the working directory", async () => {
    await run("--source", "local", "--path", "vendor/framework", "--ai", SYNTHETIC_TOOL);

    expect(builtFlow().source).toEqual(localFrameworkSource(resolve("vendor/framework")));
  });

  it("carries the release tag a remote source was pinned to", async () => {
    await run("--source", "remote", "--release", "v1.2.3", "--ai", SYNTHETIC_TOOL);

    expect(builtFlow().source).toEqual(remoteFrameworkSource(undefined, "v1.2.3"));
  });

  it("hands a user scope to the machine-wide setup alone", async () => {
    await run("--ai", ACTIVATED_SYNTHETIC_TOOL, "--scope", "user");

    const flow = setupMachineScope.mock.calls[0][0] as SetupFlow;
    expect(flow.scope).toBe("user");
    expect(setupTools).not.toHaveBeenCalled();
    expect(resolveSourceIfNeeded).not.toHaveBeenCalled();
  });
});

const OTHER_PROJECTS = (ide: string, provider: string) =>
  `Other projects follow at their next install; to update the agents they already have, run \`aidd setup --ide ${ide} --provider ${provider}\` there.`;

describe("aidd setup - the agents' provider", () => {
  it("sets the provider and the main session's model only once the install has succeeded", async () => {
    await run("--ide", `${SECOND_SYNTHETIC_TOOL},${SYNTHETIC_IDE_TOOL}`, "--provider", "openai");

    expect(setAgentModel).toHaveBeenCalledWith({
      projectRoot: PROJECT_ROOT,
      hosts: [SECOND_SYNTHETIC_TOOL],
      provider: "openai",
      scope: "project",
    });
    expect(setAgentModel.mock.invocationCallOrder[0]).toBeGreaterThan(
      resolveSourceIfNeeded.mock.invocationCallOrder[0]
    );
  });

  it("changes nothing of the provider when the install fails", async () => {
    resolveSourceIfNeeded.mockRejectedValueOnce(new Error("network down"));
    vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run("--ide", SECOND_SYNTHETIC_TOOL, "--provider", "openai")).rejects.toThrow(
      ExitRequested
    );

    expect(setAgentModel).not.toHaveBeenCalled();
  });

  it("gives the main session and the agents back the IDE's model with none", async () => {
    const lines = await run("--ide", SECOND_SYNTHETIC_TOOL, "--provider", "none");

    expect(setAgentModel).toHaveBeenCalledWith(
      expect.objectContaining({ hosts: [SECOND_SYNTHETIC_TOOL], provider: undefined })
    );
    expect(lines).toContain(`${SECOND_SYNTHETIC_TOOL}: the agents run on the IDE's model again.`);
    expect(lines).toContain(OTHER_PROJECTS(SECOND_SYNTHETIC_TOOL, "none"));
  });

  it.each([
    [
      ["--global", "--ide", `${SYNTHETIC_TOOL},${SYNTHETIC_IDE_TOOL}`, "--provider", "anthropic"],
      SYNTHETIC_IDE_TOOL,
    ],
    [["--ide", SYNTHETIC_IDE_TOOL, "--provider", "bogus"], 'Unknown provider "bogus"'],
  ])("refuses %j before building or writing anything", async (args, message) => {
    vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run(...args)).rejects.toThrow(ExitRequested);

    expect(errors.join("")).toContain(message);
    expect(vi.mocked(createDeps)).not.toHaveBeenCalled();
    expect(setAgentModel).not.toHaveBeenCalled();
  });
});

describe("aidd setup - a person at a terminal", () => {
  it("greets, names what it detected, and ends with what to do next", async () => {
    pretendTerminal(true);
    setupTools.mockResolvedValue({
      results: [{ toolId: SYNTHETIC_TOOL, fileCount: 9, files: [], skipped: false, warnings: [] }],
    });

    expect(await run()).toEqual([
      "",
      "AI-Driven Development setup",
      "Wires your AI tools, registers the framework marketplace, installs plugins.",
      "Press Ctrl-C any time to abort.",
      "",
      "Detected: a TypeScript project.",
      "Project is up to date.",
      `Installed ${SYNTHETIC_TOOL} (9 files)`,
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
          toolId: SYNTHETIC_TOOL,
          fileCount: 1,
          files: [{ relativePath: "CLAUDE.md" }],
          skipped: false,
          warnings: [],
        },
      ],
    });

    await run("--verbose", "--ai", SYNTHETIC_TOOL);

    expect(errors).toEqual([`[verbose] Tool: ${SYNTHETIC_TOOL}\n`, "[verbose]   + CLAUDE.md\n"]);
  });
});

describe("aidd setup - every flag that makes a run a scripted one", () => {
  it.each([
    [["--source", "remote"]],
    [["--release", "v1.2.3"]],
    [["--ai", SYNTHETIC_TOOL]],
    [["--ide", SYNTHETIC_IDE_TOOL]],
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

describe("aidd setup - what it refuses and what it reports", () => {
  it.each([
    { args: [], cause: "with no --ide", remedy: "Pass `--ide <ids>`" },
    {
      args: ["--ide", `${SYNTHETIC_TOOL},${SYNTHETIC_IDE_TOOL}`],
      cause: `an editor (${SYNTHETIC_IDE_TOOL})`,
      remedy: "Drop it from --ide",
    },
  ])("renders global validation for $cause before building dependencies", async (test) => {
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run("--global", ...test.args)).rejects.toThrow(ExitRequested);

    expect(errors.join("")).toContain(test.cause);
    expect(errors.join("")).toContain(test.remedy);
    expect(errors.join("")).not.toMatch(/UserScope\w+Error|\n\s+at /);
    expect(exit).toHaveBeenCalledWith(1);
    expect(vi.mocked(createDeps)).not.toHaveBeenCalled();
    expect(written).toEqual([]);
  });

  it("refuses a local source with nowhere to read it from", async () => {
    vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run("--source", "local")).rejects.toThrow(ExitRequested);

    expect(errors[0]).toBe("Error: --source local requires --path <dir>\n");
    expect(vi.mocked(createDeps)).not.toHaveBeenCalled();
  });

  it("refuses a scope it does not know", async () => {
    vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run("--scope", "machine")).rejects.toThrow(ExitRequested);

    expect(errors[0]).toBe('Error: Invalid --scope "machine" — expected "project" or "user".\n');
    expect(vi.mocked(createDeps)).not.toHaveBeenCalled();
  });

  it("refuses an IDE id offered as an AI tool, before building anything", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run("--ai", SYNTHETIC_IDE_TOOL)).rejects.toThrow(ExitRequested);

    expect(exit).toHaveBeenCalledWith(1);
    expect(vi.mocked(createDeps)).not.toHaveBeenCalled();
  });

  it("names a refused activation and fails the process", async () => {
    activation.mockResolvedValue({
      binaryMissing: [],
      failed: true,
      errors: [{ scope: SYNTHETIC_TOOL, error: `${SYNTHETIC_TOOL} CLI refused` }],
    });
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run("--ai", SYNTHETIC_TOOL)).rejects.toThrow(ExitRequested);

    expect(errors.join("")).toBe(
      `Warning: [${SYNTHETIC_TOOL}] ${SYNTHETIC_TOOL} CLI refused\nError: Sync failed for: ${SYNTHETIC_TOOL}. See the warnings above.\n`
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("names a failed install on stderr and fails the process", async () => {
    setupTools.mockRejectedValue(new Error("assets are missing"));
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run("--ai", SYNTHETIC_TOOL)).rejects.toThrow(ExitRequested);

    expect(errors.join("")).toBe("Error: assets are missing\n");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("builds the graph for this project at this run's verbosity", async () => {
    await run("--verbose", "--ai", SYNTHETIC_TOOL);

    expect(vi.mocked(createDeps)).toHaveBeenCalledWith(
      PROJECT_ROOT,
      { verbose: true },
      expect.anything()
    );
  });
});
