import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { relative, sep } from "node:path";
import { isMainThread } from "node:worker_threads";
import { Command } from "commander";
import { type MockInstance, vi } from "vitest";
import type { ToolCatalog } from "../../src/contexts/tools/contract/tool-catalog.js";
import { sandboxedEnv } from "../e2e/helpers.js";

/**
 * Drives the real Commander tree and the real `createDeps` inside the test process, under a
 * substituted environment (HOME, PATH, cwd) and nothing else. It never calls `process.chdir`,
 * which throws on worker threads: the working directory is a spy on `process.cwd`, so a child
 * process the command spawns must be given its `cwd` explicitly.
 *
 * It runs on the main thread only. On a worker thread `os.homedir()` reads the main process's
 * environment, not the substituted HOME, so the product would resolve the runner's real home.
 * Stryker runs Vitest on worker threads, so the tests that use this helper are left out of the
 * mutation run (`vitest.mutation.config.ts`).
 *
 * It restores what it changed and nothing else: a spy or an environment stub the caller made
 * before the call is still in place after it.
 *
 * It is not a copy of `src/cli.ts`, which parses at import: it registers the same commands, in
 * the same order, and leaves out the update-check hooks, which stay an end-to-end concern.
 */
export interface InProcessResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface InProcessOptions {
  /** The project directory the command sees as its working directory. Under the OS temp dir. */
  readonly cwd: string;
  /** The machine the command sees: its home, and any variable the test needs. */
  readonly home: string;
  readonly env?: Record<string, string>;
}

class ExitSignal extends Error {
  constructor(readonly code: number) {
    super(`exit ${String(code)}`);
  }
}

type Register = (program: Command, tools: ToolCatalog) => void;

/** The order `src/cli.ts` registers them in. Literal specifiers, so the bundler resolves them. */
const REGISTRATIONS: ReadonlyArray<() => Promise<Register>> = [
  async () => (await import("../../src/presentation/commands/setup.js")).registerSetupCommand,
  async () =>
    (await import("../../src/presentation/commands/framework.js")).registerFrameworkCommand,
  async () =>
    (await import("../../src/presentation/commands/translate.js")).registerTranslateCommand,
  async () => (await import("../../src/presentation/commands/plugin.js")).registerPluginCommand,
  async () =>
    (await import("../../src/presentation/commands/marketplace.js")).registerMarketplaceCommand,
  async () => (await import("../../src/presentation/commands/auth.js")).registerAuthCommand,
  async () => (await import("../../src/presentation/commands/sync.js")).registerSyncCommand,
  async () => (await import("../../src/presentation/commands/update.js")).registerUpdateCommand,
  async () => (await import("../../src/presentation/commands/doctor.js")).registerDoctorCommand,
  async () => (await import("../../src/presentation/commands/clean.js")).registerCleanCommand,
  async () =>
    (await import("../../src/presentation/commands/telemetry.js")).registerTelemetryCommand,
];

let inFlight = false;

function assertUnderTemporaryDirectory(path: string): void {
  const inside = relative(realpathSync.native(tmpdir()), realpathSync.native(path));
  if (
    inside === "" ||
    inside.startsWith("..") ||
    inside.startsWith(sep) ||
    /^[a-z]:/i.test(inside)
  ) {
    throw new Error(
      `${path} is not under the temporary directory: refusing to run a command there`
    );
  }
}

/**
 * Every variable of the runner that is not in the sandbox is removed, so none leaks through.
 * Returns the function that puts back each key it touched, to the value it had at the call.
 */
function substituteEnvironment(sandbox: NodeJS.ProcessEnv): () => void {
  const previous = new Map<string, string | undefined>();
  const assign = (key: string, value: string | undefined): void => {
    if (!previous.has(key)) previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };
  for (const key of Object.keys(process.env)) {
    if (!(key in sandbox)) assign(key, undefined);
  }
  for (const [key, value] of Object.entries(sandbox)) assign(key, value);
  return () => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

export async function runInProcess(
  args: readonly string[],
  options: InProcessOptions
): Promise<InProcessResult> {
  if (!isMainThread) {
    throw new Error(
      "runInProcess needs the main thread: home isolation does not hold on a worker thread, where os.homedir() ignores the substituted HOME"
    );
  }
  if (inFlight) {
    throw new Error("runInProcess is running another command: it mutates process-wide state");
  }
  assertUnderTemporaryDirectory(options.cwd);
  assertUnderTemporaryDirectory(options.home);
  inFlight = true;

  const out: string[] = [];
  const err: string[] = [];
  const spies: MockInstance[] = [];
  let restoreEnvironment = (): void => {};
  const previousExitCode = process.exitCode;
  const ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
  let exitCode = 0;

  try {
    restoreEnvironment = substituteEnvironment({
      ...sandboxedEnv(options.home, options.env),
      PWD: options.cwd,
    });
    spies.push(vi.spyOn(process, "cwd").mockReturnValue(options.cwd));
    spies.push(
      vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
        out.push(String(chunk));
        return true;
      })
    );
    spies.push(
      vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
        err.push(String(chunk));
        return true;
      })
    );
    spies.push(
      vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
        throw new ExitSignal(code ?? 0);
      }) as typeof process.exit)
    );
    Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });
    process.exitCode = undefined;

    // A new process starts with an empty deps cache and an empty profile registry.
    vi.resetModules();
    const { wireTools } = await import("../../src/composition/tools.js");
    const tools = wireTools();
    const program = new Command();
    program.name("aidd").option("--verbose", "Show detailed diagnostic output", false);
    for (const load of REGISTRATIONS) (await load())(program, tools);

    try {
      await program.parseAsync(["node", "aidd", ...args]);
      exitCode = typeof process.exitCode === "number" ? process.exitCode : 0;
    } catch (error) {
      if (error instanceof ExitSignal) {
        exitCode = error.code;
      } else {
        err.push(`${error instanceof Error ? error.message : String(error)}\n`);
        exitCode = 1;
      }
    }
  } finally {
    for (const spy of spies) spy.mockRestore();
    restoreEnvironment();
    if (ttyDescriptor) Object.defineProperty(process.stdout, "isTTY", ttyDescriptor);
    else delete (process.stdout as { isTTY?: boolean }).isTTY;
    process.exitCode = previousExitCode;
    inFlight = false;
  }

  return { exitCode, stdout: out.join(""), stderr: err.join("") };
}
