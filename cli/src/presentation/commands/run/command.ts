import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir, constants as osConstants } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { Command } from "commander";
import spawn from "cross-spawn";
import { Manifest } from "../../../contexts/framework/domain/manifest.js";
import { userConfigDir } from "../../../runtime/user-config-dir.js";

import { headlessRunTools } from "../../../runtime/wiring/tools.js";

type Tool = keyof typeof headlessRunTools;

function readManifest(path: string): Manifest | null {
  if (!existsSync(path)) return null;
  return Manifest.fromJSON(JSON.parse(readFileSync(path, "utf8")));
}

function projectManifest(cwd: string): { root: string; manifest: Manifest } | null {
  let root = resolve(cwd);
  while (true) {
    const manifest = readManifest(join(root, ".aidd", "manifest.json"));
    if (manifest) return { root, manifest };
    if (existsSync(join(root, ".git"))) return null;
    const parent = dirname(root);
    if (parent === root) return null;
    root = parent;
  }
}

function hasMaintenanceFiles(root: string): boolean {
  return [
    "hooks/aidd-maintenance/session-start.cjs",
    "plugin/aidd-maintenance-hooks.js",
    "plugins/aidd-maintenance-tui/server.js",
  ].some((path) => existsSync(join(root, path)));
}

function hasProjectMaintenance(cwd: string, tool: Tool): boolean {
  let root = resolve(cwd);
  while (true) {
    if (hasMaintenanceFiles(join(root, `.${tool}`))) return true;
    if (existsSync(join(root, ".git"))) return false;
    const parent = dirname(root);
    if (parent === root) return false;
    root = parent;
  }
}

function installedHook(tool: Tool, cwd: string): string {
  const override = headlessRunTools[tool].configDirEnv;
  if (process.env[override])
    throw new Error(`Cannot verify the active maintenance plugin while ${override} is set.`);
  const globalRoot = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), tool);
  if (hasMaintenanceFiles(globalRoot) && hasProjectMaintenance(cwd, tool))
    throw new Error(
      `Cannot determine the active maintenance plugin for ${tool}: project and global copies coexist.`
    );
  const project = projectManifest(cwd);
  const projectPlugin = project?.manifest
    .getPlugins(tool)
    .find((p) => p.name === "aidd-maintenance");
  const global =
    projectPlugin?.scope === "project"
      ? null
      : readManifest(join(userConfigDir(), "manifest.json"));
  const plugin =
    projectPlugin?.scope === "project"
      ? projectPlugin
      : global?.getPlugins(tool).find((p) => p.name === "aidd-maintenance" && p.scope === "user");
  const rel =
    plugin?.scope === "project"
      ? `.${tool}/hooks/aidd-maintenance/session-start.cjs`
      : "hooks/aidd-maintenance/session-start.cjs";
  const expected = plugin?.files.get(rel);
  if (!plugin || !expected)
    throw new Error(`The aidd-maintenance hook is not installed for ${tool}.`);
  const root = plugin.scope === "project" && project ? project.root : globalRoot;
  const path = join(root, rel);
  if (!existsSync(path)) throw new Error(`The aidd-maintenance hook is not installed for ${tool}.`);
  const hash = createHash("md5").update(readFileSync(path)).digest("hex");
  if (hash !== expected)
    throw new Error(`The installed aidd-maintenance hook for ${tool} was modified.`);
  return path;
}

function directoryFor(tool: Tool, args: readonly string[]): string {
  const settings = headlessRunTools[tool];
  if (settings.pureEnv && process.env[settings.pureEnv] === "1")
    throw new Error(`${tool} pure mode disables the maintenance plugin.`);
  let directory = process.cwd();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") break;
    if (
      arg === "--attach" ||
      arg.startsWith("--attach=") ||
      arg === "--server" ||
      arg.startsWith("--server=")
    )
      throw new Error("Remote servers are not supported by aidd run.");
    if (settings.interactiveFlags.includes(arg))
      throw new Error(`Use ${tool} directly for interactive sessions.`);
    if (settings.pureFlag && (arg === settings.pureFlag || arg === `${settings.pureFlag}=true`))
      throw new Error(`${tool} pure mode disables the maintenance plugin.`);
    if (settings.directoryArg && arg === settings.directoryArg) {
      if (!args[i + 1]) throw new Error("--dir requires a directory.");
      directory = args[++i];
    } else if (settings.directoryArg && arg.startsWith(`${settings.directoryArg}=`))
      directory = arg.slice(settings.directoryArg.length + 1);
  }
  return isAbsolute(directory) ? directory : resolve(directory);
}

function printNotice(tool: Tool, cwd: string): void {
  const script = installedHook(tool, cwd);
  const result = spawnSync(process.execPath, [script], {
    cwd,
    input: JSON.stringify({ hook_event_name: "SessionStart", cwd, tool }),
    encoding: "utf8",
    timeout: 10000,
  });
  const code = (result.error as NodeJS.ErrnoException | undefined)?.code;
  const closedInput = code === "EPIPE";
  if (result.status !== 0 || (result.error && !closedInput)) {
    const details = [
      code && Object.hasOwn(osConstants.errno, code) ? code : result.error ? "unknown error" : null,
      Number.isInteger(result.status) ? `exit ${result.status}` : null,
      result.signal && Object.hasOwn(osConstants.signals, result.signal)
        ? `signal ${result.signal}`
        : null,
    ].filter(Boolean);
    throw new Error(
      `The aidd-maintenance hook failed for ${tool}${details.length ? ` (${details.join(", ")})` : ""}.`
    );
  }
  let message: unknown;
  try {
    message = (JSON.parse(result.stdout) as { systemMessage?: unknown }).systemMessage;
  } catch {
    throw new Error(`Invalid aidd-maintenance hook output for ${tool}.`);
  }
  if (typeof message !== "string" || !message.trim())
    throw new Error(`Empty aidd-maintenance hook output for ${tool}.`);
  process.stderr.write(`${message.trim()}\n`);
}

async function run(tool: Tool, args: readonly string[]): Promise<void> {
  const cwd = directoryFor(tool, args);
  printNotice(tool, cwd);
  await new Promise<void>((resolvePromise) => {
    const child = spawn(tool, ["run", ...args], { stdio: "inherit" });
    let failed = false;
    const signals = ["SIGINT", "SIGTERM"] as const;
    const listeners = signals.map((signal) => {
      const listener = () => {
        child.kill(signal);
      };
      process.on(signal, listener);
      return listener;
    });
    child.once("error", (error) => {
      failed = true;
      process.stderr.write(`Unable to start ${tool}: ${error.message}\n`);
      process.exitCode = 1;
    });
    child.once("close", (code, signal) => {
      signals.forEach((name, i) => {
        process.off(name, listeners[i]);
      });
      if (failed) {
        resolvePromise();
        return;
      }
      if (signal && process.platform !== "win32") process.kill(process.pid, signal);
      else if (signal) process.exitCode = 1;
      else if (code !== null) process.exitCode = code;
      resolvePromise();
    });
  });
}

export function registerRunCommand(program: Command): void {
  program
    .command("run <tool> [args...]")
    .description("Run OpenCode or Kilo non-interactively with the installed maintenance notice")
    .allowUnknownOption()
    .action(async (tool: string, args: string[]) => {
      try {
        if (!Object.hasOwn(headlessRunTools, tool))
          throw new Error(`Supported tools: ${Object.keys(headlessRunTools).join(", ")}.`);
        await run(tool as Tool, args);
      } catch (error) {
        process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
      }
    });
}
