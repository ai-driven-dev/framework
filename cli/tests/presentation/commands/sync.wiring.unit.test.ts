import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReadMachineInstallation } from "../../../src/contexts/installation/application/doctor/read-machine-installation.js";
import {
  ManifestUnavailableError,
  UnregisteredToolError,
} from "../../../src/shared/domain/errors.js";
import { catalogOf } from "../../shared/testing/catalog-of.builder.js";
import { manifestRepositoryLoading } from "../../shared/testing/partial-ports.builder.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";

const restoreAll = vi.fn();
const restoreOne = vi.fn();
const activation = vi.fn();
const loadUserManifest = vi.fn();
const userManifestRepo = manifestRepositoryLoading(loadUserManifest);
const userPluginUpdate = vi.fn();

const createDeps = vi.fn(async () => ({
  restoreAllUseCase: { execute: restoreAll },
  restoreToolUseCase: { execute: restoreOne },
  syncSettingsUseCase: { execute: activation },
  readMachineInstallation: new ReadMachineInstallation(userManifestRepo),
  userPluginUpdateUseCase: { execute: userPluginUpdate },
}));

const { registerSyncCommand } = await import("../../../src/presentation/commands/sync.js");

const PROJECT_ROOT = process.cwd();
const CATALOG = catalogOf();

const NOTHING_RESTORED = {
  errors: [],
  failed: false,
  totalRestored: 0,
  totalKept: 0,
  pluginNamesRestored: [],
  unrestorable: [],
};

let written: string[] = [];
let errors: string[] = [];

function pretendTerminal(isTTY: boolean): void {
  Object.defineProperty(process.stdout, "isTTY", { value: isTTY, configurable: true });
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
  restoreAll.mockResolvedValue(NOTHING_RESTORED);
  restoreOne.mockResolvedValue({
    tools: [{ toolId: TOOL.claude, nothingToRestore: true }],
    totalRestored: 0,
    totalKept: 0,
    unrestorable: [],
  });
  activation.mockResolvedValue({ binaryMissing: [], errors: [], failed: false, activated: [] });
  loadUserManifest.mockResolvedValue({
    getInstalledToolIds: () => ["claude"],
    getPlugins: () => [],
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
  registerSyncCommand(program, CATALOG, createDeps);
  await program.parseAsync(["node", "aidd", "sync", ...args]);
  return written.join("").split("\n").slice(0, -1);
}

describe("aidd sync — the whole project", () => {
  it("restores first, then re-drives every registered marketplace's activation", async () => {
    expect(await run()).toEqual(["Nothing to restore — all files are unmodified."]);
    expect(restoreAll).toHaveBeenCalledWith(PROJECT_ROOT, false, false);
    expect(activation).toHaveBeenCalledWith({
      projectRoot: PROJECT_ROOT,
      recreateFrameworkIfMissing: true,
    });
    expect(restoreAll.mock.invocationCallOrder[0]).toBeLessThan(
      activation.mock.invocationCallOrder[0]
    );
  });

  it("prompts on a terminal, and stops prompting once the run was forced", async () => {
    pretendTerminal(true);

    await run();
    expect(restoreAll).toHaveBeenCalledWith(PROJECT_ROOT, false, true);

    await run("--force");
    expect(restoreAll).toHaveBeenLastCalledWith(PROJECT_ROOT, true, false);
  });

  it("names both the restoration's and the activation's refusals, and fails the process", async () => {
    restoreAll.mockResolvedValue({
      ...NOTHING_RESTORED,
      errors: [{ scope: "claude", message: "file is not ours" }],
      failed: true,
    });
    activation.mockResolvedValue({
      binaryMissing: [],
      errors: [{ scope: "codex", message: "codex CLI refused" }],
      failed: true,
      activated: [],
    });
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exited");
    });

    await expect(run()).rejects.toThrow("exited");

    expect(errors.join("")).toBe(
      "Warning: [claude] file is not ours\n" +
        "Warning: [codex] codex CLI refused\n" +
        "Error: Sync failed for: claude, codex. See the warnings above.\n"
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("fails the process on the restoration's refusal alone, the activation being clean", async () => {
    restoreAll.mockResolvedValue({
      ...NOTHING_RESTORED,
      errors: [{ scope: "claude", message: "file is not ours" }],
      failed: true,
    });
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exited");
    });

    await expect(run()).rejects.toThrow("exited");

    expect(exit).toHaveBeenCalledWith(1);
  });

  it("warns about a binary off PATH without failing the run", async () => {
    activation.mockResolvedValue({
      binaryMissing: [{ toolId: TOOL.claude, binary: "claude" }],
      errors: [],
      failed: false,
      activated: [],
    });

    await run();

    expect(errors.join("")).toBe(
      "Warning: claude: the plugin will not load until the claude CLI has run.\n"
    );
  });
});

describe("aidd sync --tool", () => {
  it("restores that tool, then activates it alone", async () => {
    expect(await run("--tool", "claude")).toEqual([
      "Nothing to restore — all files are unmodified.",
    ]);
    expect(restoreOne).toHaveBeenCalledWith({
      projectRoot: PROJECT_ROOT,
      toolId: "claude",
      files: undefined,
      force: false,
      interactive: false,
      pluginName: undefined,
    });
    expect(activation).toHaveBeenCalledWith({
      projectRoot: PROJECT_ROOT,
      toolIds: ["claude"],
      recreateFrameworkIfMissing: true,
    });
    expect(restoreAll).not.toHaveBeenCalled();
  });

  it("hands a tool no profile declares to the restore, which refuses it before any activation", async () => {
    restoreOne.mockRejectedValue(new UnregisteredToolError("nope"));
    vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exited");
    });

    await expect(run("--tool", "nope")).rejects.toThrow("exited");

    expect(restoreOne).toHaveBeenCalledWith(expect.objectContaining({ toolId: "nope" }));
    expect(activation).not.toHaveBeenCalled();
  });

  it("narrows to the files and the plugin that were named", async () => {
    await run("--tool", "claude", "--plugin", "aidd-dev", "a.md", "b.md");

    expect(restoreOne).toHaveBeenCalledWith(
      expect.objectContaining({ files: ["a.md", "b.md"], pluginName: "aidd-dev" })
    );
  });

  it("reports a project with no manifest, and activates nothing", async () => {
    restoreOne.mockRejectedValue(new ManifestUnavailableError("manifest-missing"));
    vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exited");
    });

    await expect(run("--tool", "claude")).rejects.toThrow("exited");

    expect(errors.join("")).toBe(
      "Error: No AIDD manifest found. Run `aidd setup` to initialize your project.\n"
    );
    expect(activation).not.toHaveBeenCalled();
  });
});

describe("aidd sync --tool — a refused activation", () => {
  it("names the refusal and fails the process rather than calling one tool synced", async () => {
    activation.mockResolvedValue({
      binaryMissing: [],
      errors: [{ scope: "claude", message: "claude CLI refused" }],
      failed: true,
      activated: [],
    });
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exited");
    });

    await expect(run("--tool", "claude")).rejects.toThrow("exited");

    expect(errors.join("")).toBe(
      "Warning: [claude] claude CLI refused\n" +
        "Error: Sync failed for: claude. See the warnings above.\n"
    );
    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe("aidd sync --scope user", () => {
  it("drives activation off the machine-wide manifest and restores no project file", async () => {
    activation.mockResolvedValue({
      binaryMissing: [],
      errors: [],
      failed: false,
      activated: ["claude"],
    });

    expect(await run("--scope", "user")).toEqual(["Synced native activation for: claude"]);
    expect(activation).toHaveBeenCalledWith({
      projectRoot: PROJECT_ROOT,
      scope: "user",
      toolIds: undefined,
      recreateFrameworkIfMissing: true,
    });
    expect(userPluginUpdate).not.toHaveBeenCalled();
    expect(restoreAll).not.toHaveBeenCalled();
    expect(restoreOne).not.toHaveBeenCalled();
  });

  it("says nothing is registered at user scope when activation touched no tool", async () => {
    expect(await run("--scope", "user")).toEqual([
      "Nothing to sync — no tool is registered at user scope yet.",
    ]);
  });

  it("rebuilds the global files a tool owns before driving activation, under --global", async () => {
    loadUserManifest.mockResolvedValue({
      getInstalledToolIds: () => ["claude", "opencode"],
      getPlugins: (toolId: string) => [{ scope: toolId === "opencode" ? "user" : "project" }],
    });
    userPluginUpdate.mockResolvedValue(["aidd-dev", "aidd-dev"]);

    expect(await run("--global")).toEqual(["Refreshed global files for: aidd-dev"]);
    expect(userPluginUpdate).toHaveBeenCalledWith({
      toolIds: ["opencode"],
      projectRoot: PROJECT_ROOT,
      scope: "user",
      rebuild: true,
    });
    expect(activation).toHaveBeenCalledWith(expect.objectContaining({ scope: "user" }));
  });

  it("narrows to the one tool named, still off the machine-wide manifest", async () => {
    await run("--scope", "user", "--tool", "claude");

    expect(activation).toHaveBeenCalledWith(expect.objectContaining({ toolIds: ["claude"] }));
  });

  it.each(["vscode", "bogus"])("narrows to nothing for %s, an AI tool it is not", async (name) => {
    await run("--scope", "user", "--tool", name);

    expect(userPluginUpdate).not.toHaveBeenCalled();
    expect(activation).toHaveBeenCalledWith(expect.objectContaining({ toolIds: [] }));
  });

  it("refreshes no file and still activates when the machine records no manifest", async () => {
    loadUserManifest.mockResolvedValue(null);

    await run("--scope", "user");
    await run("--scope", "user", "--tool", "claude");

    expect(userPluginUpdate).not.toHaveBeenCalled();
    expect(activation).toHaveBeenCalledTimes(2);
  });

  it("refuses a plugin filter it tracks nothing to narrow", async () => {
    vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exited");
    });

    await expect(run("--scope", "user", "--plugin", "aidd-dev")).rejects.toThrow("exited");

    expect(errors.join("")).toBe(
      "Error: --scope user tracks nothing --plugin can narrow — it names every requested tool, " +
        "not one plugin or one file. Drop --plugin, or run `aidd sync --plugin <name>` at project scope.\n"
    );
    expect(activation).not.toHaveBeenCalled();
  });

  it("refuses a file argument it tracks nothing to narrow", async () => {
    vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exited");
    });

    await expect(run("--scope", "user", "a.md")).rejects.toThrow("exited");

    expect(errors.join("")).toBe(
      "Error: --scope user tracks nothing a file argument can narrow — it names every requested tool, " +
        "not one plugin or one file. Drop a file argument, or run `aidd sync <files...>` at project scope.\n"
    );
    expect(activation).not.toHaveBeenCalled();
  });

  it("names a refused user-scope activation and fails before reporting success", async () => {
    activation.mockResolvedValue({
      binaryMissing: [],
      errors: [{ scope: "claude", message: "claude CLI refused" }],
      failed: true,
      activated: ["claude"],
    });
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exited");
    });

    await expect(run("--scope", "user")).rejects.toThrow("exited");

    expect(written.join("")).toBe("");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("refuses a scope it does not know before building anything", async () => {
    vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exited");
    });

    await expect(run("--scope", "machine")).rejects.toThrow("exited");

    expect(errors[0]).toBe('Error: Invalid --scope "machine" — expected "project" or "user".\n');
  });
});

describe("aidd sync — how it builds its graph", () => {
  it("builds the graph for this project at this run's verbosity", async () => {
    await run("--verbose");

    expect(vi.mocked(createDeps)).toHaveBeenCalledWith(
      PROJECT_ROOT,
      { verbose: true },
      expect.anything()
    );
  });
});
