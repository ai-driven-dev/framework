import { Command } from "commander";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import { bindOutput } from "../../../src/presentation/controllers/global-options.controller.js";
import { registerToolConfigCommand } from "../../../src/presentation/controllers/tool-config.controller.js";
import type { AiToolId, IdeToolId } from "../../../src/shared/domain/tool.js";
import { processOutputFactory } from "./output-factory.builder.js";
import { parseToExit } from "./parse-to-exit.builder.js";

/** Makes the process answer as a terminal, or as a pipe. */
function pretendTerminal(isTTY: boolean): void {
  Object.defineProperty(process.stdout, "isTTY", { value: isTTY, configurable: true });
}

/** The framework command over doubles: every read it makes, what it wrote, and a way to run it. */
export interface ToolConfigHarness {
  readonly installAiTool: Mock;
  readonly installIdeTool: Mock;
  readonly uninstallTools: Mock;
  readonly updateTools: Mock;
  readonly listInstalledRules: Mock;
  readonly validateRecipes: Mock;
  readonly currentVersion: Mock;
  readonly createDeps: Mock;
  readonly written: string[];
  readonly errors: string[];
  readonly pretendTerminal: (isTTY: boolean) => void;
  readonly run: (...args: string[]) => Promise<string[]>;
}

export interface ToolConfigHarnessOptions {
  readonly tools: ToolCatalog;
  /** The editor the install double reports installed. */
  readonly ideTool: IdeToolId;
  /** The runtime the uninstall double reports removed. */
  readonly aiTool: AiToolId;
}

/** Wires the framework command to succeeding doubles before each case and restores the process after. */
export function toolConfigHarness({
  tools,
  ideTool,
  aiTool,
}: ToolConfigHarnessOptions): ToolConfigHarness {
  const installAiTool: Mock = vi.fn();
  const installIdeTool: Mock = vi.fn();
  const uninstallTools: Mock = vi.fn();
  const updateTools: Mock = vi.fn();
  const listInstalledRules: Mock = vi.fn();
  const validateRecipes: Mock = vi.fn();
  const currentVersion: Mock = vi.fn(() => "5.2.2");
  const createDeps: Mock = vi.fn(async () => ({
    installAiToolUseCase: { execute: installAiTool },
    installIdeToolUseCase: { execute: installIdeTool },
    uninstallTools: { execute: uninstallTools },
    updateToolsUseCase: { execute: updateTools },
    listInstalledRulesUseCase: { execute: listInstalledRules },
    validateRecipes: { execute: validateRecipes },
    currentVersionProvider: { get: currentVersion },
  }));
  const written: string[] = [];
  const errors: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    written.length = 0;
    errors.length = 0;
    pretendTerminal(false);
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      errors.push(String(chunk));
      return true;
    });
    currentVersion.mockReturnValue("5.2.2");
    installAiTool.mockResolvedValue({
      runtimeResult: { skipped: false, fileCount: 5, warnings: [] },
      propagationWarnings: [],
      activation: undefined,
    });
    installIdeTool.mockResolvedValue({
      skipped: false,
      toolId: ideTool,
      fileCount: 2,
      warnings: [],
    });
    uninstallTools.mockResolvedValue([{ toolId: aiTool, fileCount: 4 }]);
    updateTools.mockResolvedValue({ updatedTools: [], errors: [] });
    listInstalledRules.mockResolvedValue({ rules: [] });
    validateRecipes.mockReturnValue({ findings: [], fileCount: 1 });
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
    registerToolConfigCommand(program, tools, createDeps);
    await parseToExit(program, ["node", "aidd", "framework", ...args]);
    return written.join("").split("\n").slice(0, -1);
  }

  return {
    installAiTool,
    installIdeTool,
    uninstallTools,
    updateTools,
    listInstalledRules,
    validateRecipes,
    currentVersion,
    createDeps,
    written,
    errors,
    pretendTerminal,
    run,
  };
}
