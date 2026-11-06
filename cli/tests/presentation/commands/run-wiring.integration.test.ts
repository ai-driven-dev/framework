import { ChildProcess, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, parse, relative } from "node:path";
import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const host = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock("cross-spawn", () => ({ default: host.spawn }));
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, spawnSync: vi.fn(actual.spawnSync) };
});

const { registerRunCommand } = await import("../../../src/presentation/commands/run/command.js");

let root: string;
let project: string;
let config: string;
let errors: string[];
let child: ChildProcess;

const notice = 'process.stdout.write(JSON.stringify({systemMessage:"MAINTENANCE NOTICE"}));';

function file(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function install(tool: "kilo" | "opencode", scope: "project" | "user", script = notice): string {
  const scriptPath =
    scope === "project"
      ? join(project, `.${tool}`, "hooks/aidd-maintenance/session-start.cjs")
      : join(config, tool, "hooks/aidd-maintenance/session-start.cjs");
  const manifestPath =
    scope === "project" ? join(project, ".aidd/manifest.json") : join(config, "aidd/manifest.json");
  const rel =
    scope === "project"
      ? `.${tool}/hooks/aidd-maintenance/session-start.cjs`
      : "hooks/aidd-maintenance/session-start.cjs";
  file(scriptPath, script);
  file(
    manifestPath,
    JSON.stringify({
      version: 8,
      tools: {
        [tool]: {
          toolId: tool,
          version: "5.6.0",
          files: [],
          plugins: [
            {
              name: "aidd-maintenance",
              version: "0.1.0",
              source: { kind: "local", path: root },
              strict: false,
              scope,
              marketplace: "aidd-framework",
              files: { [rel]: createHash("md5").update(script).digest("hex") },
            },
          ],
        },
      },
    })
  );
  return scriptPath;
}

async function run(tool: string, ...args: string[]): Promise<void> {
  const program = new Command();
  program.exitOverride();
  registerRunCommand(program);
  await program.parseAsync(["node", "aidd", "run", tool, "--", ...args]);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "run-wiring-"));
  project = join(root, "project");
  config = join(root, "config");
  mkdirSync(project);
  mkdirSync(join(project, ".git"));
  vi.stubEnv("XDG_CONFIG_HOME", config);
  vi.stubEnv("AIDD_USER_CONFIG_DIR", "");
  vi.stubEnv("KILO_CONFIG_DIR", "");
  vi.stubEnv("OPENCODE_CONFIG_DIR", "");
  vi.stubEnv("KILO_PURE", "");
  vi.spyOn(process, "cwd").mockReturnValue(project);
  vi.spyOn(process, "kill").mockReturnValue(true);
  errors = [];
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    errors.push(String(chunk));
    return true;
  });
  child = new ChildProcess();
  host.spawn.mockReset();
  host.spawn.mockImplementation(() => {
    queueMicrotask(() => child.emit("close", 0, null));
    return child;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  process.exitCode = undefined;
  rmSync(root, { recursive: true, force: true });
});

describe("headless launcher", () => {
  it.each(["kilo", "opencode"] as const)(
    "runs the recorded %s hook and forwards arguments",
    async (tool) => {
      install(tool, "project");
      await run(tool, "--format", "json", "hello world");
      expect(errors.join("")).toBe("MAINTENANCE NOTICE\n");
      expect(host.spawn).toHaveBeenCalledWith(tool, ["run", "--format", "json", "hello world"], {
        stdio: "inherit",
      });
      expect(process.exitCode).toBe(0);
    }
  );

  it.each([
    "hooks/aidd-maintenance/session-start.cjs",
    "plugin/aidd-maintenance-hooks.js",
    "plugins/aidd-maintenance-tui/server.js",
  ])("refuses an untracked project copy identified by %s", async (path) => {
    install("opencode", "user");
    file(join(project, ".opencode", path), "foreign plugin");
    await run("opencode");
    expect(errors.join("")).toMatch(/project and global copies coexist/i);
    expect(host.spawn).not.toHaveBeenCalled();
  });

  it("rejects an unknown tool before invoking it", async () => {
    await run("unknown");
    expect(errors.join("")).toContain("Supported tools: opencode, kilo");
    expect(process.exitCode).toBe(1);
    expect(host.spawn).not.toHaveBeenCalled();
  });

  it.each([
    ["opencode", "OPENCODE_CONFIG_DIR"],
    ["kilo", "KILO_CONFIG_DIR"],
  ] as const)("rejects an overridden %s configuration", async (tool, key) => {
    install(tool, "project");
    vi.stubEnv(key, join(root, "override"));
    await run(tool);
    expect(errors.join("")).toContain(key);
    expect(host.spawn).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("reports a timeout and signal without exposing hook output or error details", async () => {
    install("opencode", "project");
    vi.mocked(spawnSync).mockReturnValueOnce({
      error: Object.assign(new Error("secret path sensitive-location"), { code: "ETIMEDOUT" }),
      status: null,
      stdout: "secret stdout",
      stderr: "secret stderr",
      signal: "SIGTERM",
      pid: 1,
      output: [null, "secret stdout", "secret stderr"],
    });
    await run("opencode");
    expect(errors.join("")).toContain("ETIMEDOUT");
    expect(errors.join("")).toContain("SIGTERM");
    expect(errors.join("")).not.toContain("secret");
    expect(errors.join("")).not.toContain("sensitive-location");
    expect(host.spawn).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("does not include unrecognized error codes or signals in diagnostics", async () => {
    install("opencode", "project");
    vi.mocked(spawnSync).mockReturnValueOnce({
      error: Object.assign(new Error("private message"), { code: "SECRET_CODE" }),
      status: 1,
      stdout: "",
      stderr: "private output",
      signal: "SECRET_SIGNAL" as NodeJS.Signals,
      pid: 1,
      output: [null, "", "private output"],
    });
    await run("opencode");
    expect(errors.join("")).toContain("exit 1");
    expect(errors.join("")).toContain("unknown error");
    expect(errors.join("")).not.toContain("SECRET");
    expect(errors.join("")).not.toContain("private");
    expect(host.spawn).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it.each(["kilo", "opencode"] as const)(
    "rejects competing project and global %s hooks",
    async (tool) => {
      install(tool, "project");
      install(tool, "user");
      await run(tool);
      expect(errors.join("")).toMatch(/project and global copies coexist/i);
      expect(host.spawn).not.toHaveBeenCalled();
    }
  );

  it("uses the global hook in the selected XDG directory", async () => {
    install("opencode", "user");
    await run("opencode", "hi");
    expect(errors.join("")).toBe("MAINTENANCE NOTICE\n");
    expect(host.spawn).toHaveBeenCalledWith("opencode", ["run", "hi"], { stdio: "inherit" });
  });

  it("does not confuse an unrelated project configuration directory with a maintenance hook", async () => {
    install("opencode", "user");
    file(join(project, ".opencode", "unrelated-plugin.js"), "foreign plugin");
    await run("opencode");
    expect(errors.join("")).toBe("MAINTENANCE NOTICE\n");
    expect(host.spawn).toHaveBeenCalledOnce();
  });

  it("checks for conflicts across nested project directories", async () => {
    install("opencode", "user");
    file(join(project, ".opencode", "plugin/aidd-maintenance-hooks.js"), "project plugin");
    const nested = join(project, "nested");
    mkdirSync(nested);
    vi.mocked(process.cwd).mockReturnValue(nested);
    await run("opencode");
    expect(errors.join("")).toMatch(/project and global copies coexist/i);
    expect(host.spawn).not.toHaveBeenCalled();
  });

  it("does not mistake a plugin above the Git root for a conflict", async () => {
    install("opencode", "user");
    file(join(root, ".opencode", "plugin/aidd-maintenance-hooks.js"), "parent plugin");
    await run("opencode");
    expect(errors.join("")).toBe("MAINTENANCE NOTICE\n");
    expect(host.spawn).toHaveBeenCalledOnce();
  });

  it("can find a global installation when invoked at the filesystem root", async () => {
    install("opencode", "user");
    vi.mocked(process.cwd).mockReturnValue(parse(project).root);
    await run("opencode");
    expect(errors.join("")).toBe("MAINTENANCE NOTICE\n");
    expect(host.spawn).toHaveBeenCalledOnce();
  });

  it("ignores unrelated project plugins when selecting a global installation", async () => {
    install("opencode", "project");
    const manifest = join(project, ".aidd/manifest.json");
    const data = JSON.parse(readFileSync(manifest, "utf8"));
    data.tools.opencode.plugins[0].name = "unrelated-plugin";
    file(manifest, JSON.stringify(data));
    rmSync(join(project, ".opencode"), { recursive: true });
    install("opencode", "user");
    await run("opencode");
    expect(errors.join("")).toBe("MAINTENANCE NOTICE\n");
    expect(host.spawn).toHaveBeenCalledOnce();
  });

  it.each(["project", "user"] as const)(
    "refuses unrelated plugins in the %s manifest",
    async (scope) => {
      install("opencode", scope);
      const manifest =
        scope === "project"
          ? join(project, ".aidd/manifest.json")
          : join(config, "aidd/manifest.json");
      const data = JSON.parse(readFileSync(manifest, "utf8"));
      data.tools.opencode.plugins[0].name = "unrelated-plugin";
      file(manifest, JSON.stringify(data));
      await run("opencode");
      expect(errors.join("")).toMatch(/not installed/i);
      expect(host.spawn).not.toHaveBeenCalled();
    }
  );

  it("does not execute a project-scoped record from the global manifest", async () => {
    install("opencode", "user");
    const manifest = join(config, "aidd/manifest.json");
    const data = JSON.parse(readFileSync(manifest, "utf8"));
    data.tools.opencode.plugins[0].scope = "project";
    file(manifest, JSON.stringify(data));
    await run("opencode");
    expect(errors.join("")).toMatch(/not installed/i);
    expect(host.spawn).not.toHaveBeenCalled();
  });

  it("stops at a git root rather than using the parent project's hook", async () => {
    install("opencode", "project");
    const childProject = join(project, "child");
    mkdirSync(join(childProject, ".git"), { recursive: true });
    vi.mocked(process.cwd).mockReturnValue(childProject);
    await run("opencode");
    expect(errors.join("")).toMatch(/not installed/i);
    expect(host.spawn).not.toHaveBeenCalled();
  });

  it("discovers a project hook from its nested working directory", async () => {
    install("kilo", "project");
    const nested = join(project, "nested");
    mkdirSync(nested);
    vi.mocked(process.cwd).mockReturnValue(nested);
    await run("kilo");
    expect(errors.join("")).toBe("MAINTENANCE NOTICE\n");
  });

  it("refuses to execute a modified recorded script", async () => {
    const script = install("kilo", "project");
    writeFileSync(script, 'throw Error("untrusted script ran")');
    await run("kilo");
    expect(errors.join("")).toMatch(/modified/i);
    expect(errors.join("")).not.toContain("untrusted script ran");
    expect(host.spawn).not.toHaveBeenCalled();
  });

  it("refuses a script that is present but has no manifest", async () => {
    file(join(project, ".kilo/hooks/aidd-maintenance/session-start.cjs"), notice);
    await run("kilo");
    expect(errors.join("")).toMatch(/not installed/i);
    expect(host.spawn).not.toHaveBeenCalled();
  });

  it("refuses a missing script even when it is recorded", async () => {
    const script = install("kilo", "project");
    rmSync(script);
    await run("kilo");
    expect(errors.join("")).toMatch(/not installed/i);
    expect(host.spawn).not.toHaveBeenCalled();
  });

  it("refuses a script without its recorded hash", async () => {
    install("kilo", "project");
    const manifest = join(project, ".aidd/manifest.json");
    const data = JSON.parse(readFileSync(manifest, "utf8"));
    data.tools.kilo.plugins[0].files = {};
    file(manifest, JSON.stringify(data));
    await run("kilo");
    expect(errors.join("")).toMatch(/not installed/i);
    expect(host.spawn).not.toHaveBeenCalled();
  });

  it.each([
    ["--attach", "http://localhost"],
    ["--attach=http://localhost"],
    ["--server", "http://localhost"],
    ["--server=http://localhost"],
  ])("rejects remote argument %s", async (...args) => {
    await run("kilo", ...args);
    expect(errors.join("")).toContain("Remote servers are not supported");
    expect(host.spawn).not.toHaveBeenCalled();
  });

  it.each(["--interactive", "-i", "--interactive=true"])(
    "rejects interactive flag %s",
    async (flag) => {
      await run("kilo", flag);
      expect(errors.join("")).toContain("directly for interactive sessions");
      expect(host.spawn).not.toHaveBeenCalled();
    }
  );

  it.each(["--pure", "--pure=true"])("rejects pure flag %s", async (flag) => {
    await run("kilo", flag);
    expect(errors.join("")).toContain("pure mode disables");
    expect(host.spawn).not.toHaveBeenCalled();
  });

  it("rejects pure mode from the environment", async () => {
    vi.stubEnv("KILO_PURE", "1");
    await run("kilo");
    expect(errors.join("")).toContain("pure mode disables");
    expect(host.spawn).not.toHaveBeenCalled();
  });

  it.each(["--dir", "--dir="])("uses Kilo's directory argument %s", async (flag) => {
    install("kilo", "project");
    vi.mocked(process.cwd).mockReturnValue(root);
    const rel = relative(root, project);
    await run("kilo", ...(flag === "--dir" ? [flag, rel] : [`${flag}${rel}`]), "prompt");
    expect(errors.join("")).toBe("MAINTENANCE NOTICE\n");
    expect(host.spawn).toHaveBeenCalledOnce();
  });

  it("requires a value after --dir", async () => {
    await run("kilo", "--dir");
    expect(errors.join("")).toContain("--dir requires a directory");
    expect(host.spawn).not.toHaveBeenCalled();
  });

  it("passes literal options after the end-of-options marker to the host", async () => {
    install("kilo", "project");
    await run("kilo", "--", "--attach");
    expect(errors.join("")).toBe("MAINTENANCE NOTICE\n");
    expect(host.spawn).toHaveBeenCalledWith("kilo", ["run", "--", "--attach"], {
      stdio: "inherit",
    });
  });

  it("sends the hook its working directory and the requested host", async () => {
    install(
      "kilo",
      "project",
      `let input=""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { const x = JSON.parse(input); process.stdout.write(JSON.stringify({systemMessage: [x.hook_event_name, x.cwd, x.tool].join("|")})); });`
    );
    await run("kilo");
    expect(errors.join("")).toBe(`SessionStart|${project}|kilo\n`);
  });

  it("trims hook notices before showing them", async () => {
    install(
      "opencode",
      "project",
      'process.stdout.write(JSON.stringify({systemMessage:"  NOTICE  "}));'
    );
    await run("opencode");
    expect(errors.join("")).toBe("NOTICE\n");
  });

  it("accepts an EPIPE when the hook exited successfully with a valid notice", async () => {
    install("opencode", "project");
    vi.mocked(spawnSync).mockReturnValueOnce({
      error: Object.assign(new Error("pipe closed"), { code: "EPIPE" }),
      status: 0,
      stdout: JSON.stringify({ systemMessage: "NOTICE" }),
      stderr: "",
      signal: null,
      pid: 1,
      output: [null, JSON.stringify({ systemMessage: "NOTICE" }), ""],
    });
    await run("opencode");
    expect(errors.join("")).toBe("NOTICE\n");
    expect(host.spawn).toHaveBeenCalledOnce();
  });

  it.each([
    [{ code: "EPIPE", status: 1 }, "hook failed"],
    [{ code: "EACCES", status: 0 }, "hook failed"],
    [{ code: "EPIPE", status: 0 }, "Invalid"],
  ])("still rejects failed processes and malformed output", async ({ code, status }, expected) => {
    install("opencode", "project");
    vi.mocked(spawnSync).mockReturnValueOnce({
      error: Object.assign(new Error("spawn failed"), { code }),
      status,
      stdout: "bad json",
      stderr: "",
      signal: null,
      pid: 1,
      output: [null, "bad json", ""],
    });
    await run("opencode");
    expect(errors.join("")).toContain(expected);
    expect(host.spawn).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it.each([
    ["process.exitCode=2", "hook failed"],
    ['process.stdout.write("bad json")', "Invalid"],
    ['process.stdout.write(JSON.stringify({systemMessage:"  "}))', "Empty"],
    ["process.stdout.write(JSON.stringify({systemMessage:9}))", "Empty"],
  ])("rejects failed or malformed hook output", async (script, expected) => {
    install("opencode", "project", script);
    await run("opencode");
    expect(errors.join("")).toContain(expected);
    expect(host.spawn).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("propagates the host exit code", async () => {
    install("opencode", "project");
    host.spawn.mockImplementation(() => {
      queueMicrotask(() => child.emit("close", 7, null));
      return child;
    });
    await run("opencode");
    expect(process.exitCode).toBe(7);
  });

  it("reports an executable that fails to start", async () => {
    install("kilo", "project");
    host.spawn.mockImplementation(() => {
      queueMicrotask(() => {
        child.emit("error", new Error("not found"));
        child.emit("close", -1, null);
      });
      return child;
    });
    await run("kilo");
    expect(errors.join("")).toContain("Unable to start kilo: not found");
    expect(process.exitCode).toBe(1);
  });

  it("forwards termination signals to the host and removes listeners afterwards", async () => {
    install("kilo", "project");
    const listeners = new Set(process.listeners("SIGINT"));
    const kill = vi.spyOn(child, "kill").mockReturnValue(true);
    host.spawn.mockImplementation(() => {
      queueMicrotask(() => {
        for (const listener of process.listeners("SIGINT")) {
          if (!listeners.has(listener)) listener("SIGINT");
        }
        child.emit("close", 0, null);
      });
      return child;
    });
    await run("kilo");
    expect(kill).toHaveBeenCalledWith("SIGINT");
    expect(process.listeners("SIGINT")).toEqual([...listeners]);
  });

  it.skipIf(process.platform === "win32")("propagates termination by the host", async () => {
    install("kilo", "project");
    host.spawn.mockImplementation(() => {
      queueMicrotask(() => child.emit("close", null, "SIGTERM"));
      return child;
    });
    await run("kilo");
    expect(process.kill).toHaveBeenCalledWith(process.pid, "SIGTERM");
  });

  it.skipIf(process.platform !== "win32")(
    "reports host termination as failure on Windows",
    async () => {
      install("kilo", "project");
      host.spawn.mockImplementation(() => {
        queueMicrotask(() => child.emit("close", null, "SIGTERM"));
        return child;
      });
      await run("kilo");
      expect(process.exitCode).toBe(1);
    }
  );
});
