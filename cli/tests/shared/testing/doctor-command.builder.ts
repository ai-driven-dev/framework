import { Command } from "commander";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { wireTools } from "../../../src/composition/tools.js";
import { ReadMachineInstallation } from "../../../src/contexts/installation/application/doctor/read-machine-installation.use-case.js";
import { RunUserScopeDoctor } from "../../../src/orchestration/doctor/run-user-scope-doctor.use-case.js";
import { registerDoctorCommand } from "../../../src/presentation/commands/doctor.js";
import { bindOutput } from "../../../src/presentation/commands/global-options.js";
import { processOutputFactory } from "./output-factory.builder.js";
import { parseToExit } from "./parse-to-exit.builder.js";
import { manifestRepositoryLoading } from "./partial-ports.builder.js";

/** A scope with nothing to report. */
export const HEALTHY_SCOPE = { toolHealth: [], issues: [] };

/** The doctor command over doubles: every read it makes, what it wrote, and a way to run it. */
export interface DoctorHarness {
  readonly doctorAll: Mock;
  readonly statusAll: Mock;
  readonly doctorScoped: Mock;
  readonly statusScoped: Mock;
  readonly doctorRegistration: Mock;
  readonly loadUserManifest: Mock;
  readonly homedir: Mock;
  readonly createDeps: Mock;
  readonly written: string[];
  readonly errors: string[];
  readonly catalog: ReturnType<typeof wireTools>;
  readonly run: (...args: string[]) => Promise<string[]>;
}

/** Wires the doctor command to healthy doubles before each case and restores the process after. */
export function doctorHarness(): DoctorHarness {
  const doctorAll: Mock = vi.fn();
  const statusAll: Mock = vi.fn();
  const doctorScoped: Mock = vi.fn();
  const statusScoped: Mock = vi.fn();
  const doctorRegistration: Mock = vi.fn();
  const loadUserManifest: Mock = vi.fn();
  const homedir: Mock = vi.fn(() => "/home/dev");
  const createDeps: Mock = vi.fn(async () => ({
    doctorAllUseCase: { execute: doctorAll },
    statusAllUseCase: { execute: statusAll },
    doctorUseCase: { execute: doctorScoped },
    statusUseCase: { execute: statusScoped },
    runUserScopeDoctor: new RunUserScopeDoctor(
      new ReadMachineInstallation(manifestRepositoryLoading(loadUserManifest)),
      { execute: doctorRegistration }
    ),
    homedir,
    environment: { get: () => undefined, set: () => undefined },
  }));
  const catalog = wireTools();
  const written: string[] = [];
  const errors: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    written.length = 0;
    errors.length = 0;
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      errors.push(String(chunk));
      return true;
    });
    homedir.mockReturnValue("/home/dev");
    doctorAll.mockResolvedValue({
      errors: [],
      ai: HEALTHY_SCOPE,
      ide: HEALTHY_SCOPE,
      pluginIssues: [],
      healthy: true,
    });
    statusAll.mockResolvedValue({
      aiTools: { tools: [] },
      ideTools: { tools: [] },
      pluginDrift: [],
    });
    doctorScoped.mockResolvedValue({ toolHealth: [], issues: [], pluginIssues: [], healthy: true });
    statusScoped.mockResolvedValue({ tools: [], pluginDrift: [] });
    doctorRegistration.mockResolvedValue([]);
    loadUserManifest.mockResolvedValue({
      getInstalledToolIds: () => ["claude"],
      getToolVersion: () => "5.2.2",
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
    registerDoctorCommand(program, catalog, createDeps);
    await parseToExit(program, ["node", "aidd", "doctor", ...args]);
    return written.join("").split("\n").slice(0, -1);
  }

  return {
    doctorAll,
    statusAll,
    doctorScoped,
    statusScoped,
    doctorRegistration,
    loadUserManifest,
    homedir,
    createDeps,
    written,
    errors,
    catalog,
    run,
  };
}
