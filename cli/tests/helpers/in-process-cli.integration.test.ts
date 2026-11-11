import { existsSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hostExecutableLookup,
  resolveExecutableOnPath,
} from "../../src/contexts/host-registration/infrastructure/executable-on-path.js";
import { git } from "./git-sandbox.js";
import { runInProcess } from "./in-process-cli.js";
import { createTelemetrySandbox } from "./telemetry-sandbox.js";

const FRAMEWORK_REAL = join(import.meta.dirname, "..", "fixtures", "framework-real");
const HOST_BINARIES = ["claude", "codex", "copilot", "cursor-agent", "opencode"];

let root: string;
let project: string;
let home: string;

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "aidd-in-process-")));
  project = join(root, "project");
  home = join(root, "home");
  await mkdir(project, { recursive: true });
  await mkdir(home, { recursive: true });
});

afterEach(async () => {
  vi.doUnmock("../../src/presentation/commands/clean.js");
  await rm(root, { recursive: true, force: true });
});

const SETUP = [
  "setup",
  "--source",
  "local",
  "--path",
  FRAMEWORK_REAL,
  "--ai",
  "claude",
  "--plugins",
  "none",
  "--yes",
];

describe("running a command in process", () => {
  it("answers --help with exit 0 and the root usage on stdout", async () => {
    const result = await runInProcess(["--help"], { cwd: project, home });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: aidd");
  });

  it("answers an unknown command with exit 1 and unknown command on stderr", async () => {
    const result = await runInProcess(["no-such-command"], { cwd: project, home });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("unknown command");
  });

  it("writes setup's manifest under the given cwd and nothing under the real home", async () => {
    const realHome = process.env.HOME;
    const before = existsSync(join(realHome ?? root, ".aidd"));

    const result = await runInProcess(SETUP, { cwd: project, home });

    expect(result.exitCode).toBe(0);
    expect(existsSync(join(project, ".aidd", "manifest.json"))).toBe(true);
    expect(existsSync(join(realHome ?? root, ".aidd"))).toBe(before);
  });

  it("lists every registered profile in setup --help, kilo included", async () => {
    const result = await runInProcess(["setup", "--help"], { cwd: project, home });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--ide claude,codex,copilot,cursor,kilo,opencode");
  });

  it("explains the user-scope restrictions in setup --help", async () => {
    const result = await runInProcess(["setup", "--help"], { cwd: project, home });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("--plugins all, recommended, none or names");
    expect(result.stdout).toContain("no editor");
    expect(result.stdout).toContain("must be on PATH");
    expect(result.stdout).toContain("opencode gets their files in ~/.config/opencode");
  });

  it("finds no host binary on PATH from inside a command", async () => {
    let found: Array<string | undefined> = [];
    vi.doMock("../../src/presentation/commands/clean.js", () => ({
      registerCleanCommand: (program: import("commander").Command) => {
        program.command("clean").action(() => {
          found = HOST_BINARIES.map((binary) =>
            resolveExecutableOnPath(binary, hostExecutableLookup())
          );
        });
      },
    }));

    const result = await runInProcess(["clean"], { cwd: project, home });

    expect(result.exitCode).toBe(0);
    expect(found).toEqual(HOST_BINARIES.map(() => undefined));
  });

  it("shows the command the given cwd and home, and nothing of the runner's", async () => {
    let seen: { cwd: string; home: string | undefined; pwd: string | undefined } | undefined;
    vi.doMock("../../src/presentation/commands/clean.js", () => ({
      registerCleanCommand: (program: import("commander").Command) => {
        program.command("clean").action(() => {
          seen = { cwd: process.cwd(), home: process.env.HOME, pwd: process.env.PWD };
        });
      },
    }));

    await runInProcess(["clean"], { cwd: project, home });

    expect(seen).toEqual({ cwd: project, home, pwd: project });
  });

  it("restores the working directory, the environment and the exit code when the run throws", async () => {
    vi.doMock("../../src/presentation/commands/clean.js", () => ({
      registerCleanCommand: () => {
        throw new Error("registration failed");
      },
    }));
    const cwd = process.cwd();
    const env = { ...process.env };
    const stdoutWrite = process.stdout.write;
    const stderrWrite = process.stderr.write;
    const exit = process.exit;
    const exitCode = process.exitCode;
    const isTTY = process.stdout.isTTY;

    await expect(runInProcess(["clean"], { cwd: project, home })).rejects.toThrow(
      "registration failed"
    );

    expect(process.cwd()).toBe(cwd);
    expect(process.env).toEqual(env);
    expect(process.stdout.write).toBe(stdoutWrite);
    expect(process.stderr.write).toBe(stderrWrite);
    expect(process.exit).toBe(exit);
    expect(process.exitCode).toBe(exitCode);
    expect(process.stdout.isTTY).toBe(isTTY);
  });

  it("gives each call its own dependencies, so the second sees the manifest the first wrote", async () => {
    const first = await runInProcess(SETUP, { cwd: project, home });
    const second = await runInProcess(["doctor"], { cwd: project, home });

    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain("healthy");
  });

  it("builds new dependencies on every call, as a new process would", async () => {
    const built: unknown[] = [];
    vi.doMock("../../src/presentation/commands/clean.js", () => ({
      registerCleanCommand: (program: import("commander").Command) => {
        program.command("clean").action(async () => {
          const { createDeps } = await import("../../src/runtime/wiring/framework.js");
          const { CLIOutput } = await import("../../src/presentation/output.js");
          built.push(await createDeps(process.cwd(), { verbose: false }, new CLIOutput(false)));
        });
      },
    }));

    await runInProcess(["clean"], { cwd: project, home });
    await runInProcess(["clean"], { cwd: project, home });

    expect(built).toHaveLength(2);
    expect(built[0]).not.toBe(built[1]);
  });

  it("reports the exit code a command sets and leaves the runner's own untouched", async () => {
    vi.doMock("../../src/presentation/commands/clean.js", () => ({
      registerCleanCommand: (program: import("commander").Command) => {
        program.command("clean").action(() => {
          process.exitCode = 3;
        });
      },
    }));
    const before = process.exitCode;

    const result = await runInProcess(["clean"], { cwd: project, home });

    expect(result.exitCode).toBe(3);
    expect(process.exitCode).toBe(before);
  });

  it("runs git in the given cwd, so telemetry on writes that repository's git config", async () => {
    const sandbox = createTelemetrySandbox();
    try {
      const repository = sandbox.repository("target");
      const runnerConfig = () => git(process.cwd(), sandbox.gitEnv, "config", "--local", "--list");
      const runnerBefore = runnerConfig();

      const result = await runInProcess(["telemetry", "on", "--yes", "--anonymous"], {
        cwd: repository,
        home: sandbox.home,
        env: sandbox.env(),
      });

      expect(result.exitCode).toBe(0);
      expect(git(repository, sandbox.gitEnv, "config", "--local", "aidd.telemetry")).toMatch(/^2:/);
      expect(runnerConfig()).toBe(runnerBefore);
    } finally {
      await rm(sandbox.root, { recursive: true, force: true });
    }
  });

  it("leaves the caller's own environment stub and spy in place after the call", async () => {
    vi.stubEnv("CALLER_OWN_STUB", "kept");
    const random = vi.spyOn(Math, "random").mockReturnValue(0.25);
    try {
      await runInProcess(["--help"], { cwd: project, home });

      expect(process.env.CALLER_OWN_STUB).toBe("kept");
      expect(Math.random()).toBe(0.25);
    } finally {
      random.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  it("refuses a second call started before the first resolves", async () => {
    const first = runInProcess(["--help"], { cwd: project, home });

    await expect(runInProcess(["--help"], { cwd: project, home })).rejects.toThrow(
      "another command"
    );
    expect((await first).exitCode).toBe(0);
  });

  it("refuses a cwd outside the temporary directory", async () => {
    await expect(runInProcess(["--help"], { cwd: process.cwd(), home })).rejects.toThrow(
      "not under the temporary directory"
    );
  });
});
