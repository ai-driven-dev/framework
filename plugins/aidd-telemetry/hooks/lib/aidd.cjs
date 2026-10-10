const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { cleanEnv } = require("./git.cjs");

// npm puts `aidd.cmd` beside this folder on Windows; the CLI it runs is here.
const CLI_ENTRY = path.join("node_modules", "@ai-driven-dev", "cli", "dist", "cli.js");
// What may reach cmd.exe: it expands % ^ ! and quotes even inside quotes, so nothing else.
const CMD_SAFE = /^[A-Za-z0-9._:/@#+,=\\-]+$/u;

function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function pathEntries(env, platform) {
  const key = platform === "win32" ? Object.keys(env).find((k) => k.toLowerCase() === "path") : "PATH";
  const value = key === undefined ? "" : env[key] ?? "";
  const delimiter = platform === "win32" ? ";" : ":";
  const flavour = platform === "win32" ? path.win32 : path.posix;
  // An empty entry means the current directory: never searched.
  return value.split(delimiter).filter((entry) => entry !== "" && flavour.isAbsolute(entry));
}

/** Where `aidd` is, as a way to run it with an argument list and no shell:
 * `{command, prefix}` (run directly), or `{shim}` (a Windows .cmd with no CLI beside it, which
 * only cmd.exe can run). Null when `aidd` is not on PATH.
 *
 * On Windows a .cmd cannot be spawned without a shell (Node refuses it), and a shell would
 * re-read the arguments. So the shim's own CLI entry is run with this node when it is beside
 * the shim, and cmd.exe is the last resort, reached only with arguments `CMD_SAFE` allows. */
function resolveAidd({ env = process.env, platform = process.platform } = {}) {
  const flavour = platform === "win32" ? path.win32 : path.posix;
  const extensions =
    platform === "win32"
      ? (env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean)
      : [""];
  for (const dir of pathEntries(env, platform)) {
    for (const extension of extensions) {
      const candidate = flavour.join(dir, `aidd${extension}`);
      if (!isFile(candidate)) continue;
      if (platform !== "win32") {
        try {
          fs.accessSync(candidate, fs.constants.X_OK);
        } catch {
          continue;
        }
        return { command: candidate, prefix: [] };
      }
      const lower = extension.toLowerCase();
      if (lower === ".exe" || lower === ".com") return { command: candidate, prefix: [] };
      const entry = flavour.join(dir, CLI_ENTRY);
      if (isFile(entry)) return { command: process.execPath, prefix: [entry] };
      return { shim: candidate };
    }
  }
  return null;
}

/** The line `cmd.exe /d /s /c` is given for a shim. `/s` strips the first and the last quote of
 * the line, so the shim's own quoted path is wrapped in one more pair, as Node does for
 * `shell: true`; without it a path holding a space loses its quotes and does not run. */
function cmdLine(shim, argv) {
  return `""${shim}" ${argv.join(" ")}"`;
}

/** Runs the resolved `aidd` with `argv`. Never inherits stdio: the hook's stdout is the
 * protocol. A refusal or a timeout is a result with `status` null. */
function runAidd(resolved, argv, { cwd, env = process.env, timeout }) {
  let run;
  if (resolved.shim !== undefined) {
    if (!argv.every((arg) => CMD_SAFE.test(arg))) {
      return { status: null, stdout: "", stderr: "", refused: true };
    }
    run = spawnSync(env.ComSpec || "cmd.exe", ["/d", "/s", "/c", cmdLine(resolved.shim, argv)], {
      cwd,
      env: cleanEnv(env),
      encoding: "utf8",
      windowsHide: true,
      windowsVerbatimArguments: true,
      timeout,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } else {
    run = spawnSync(resolved.command, [...resolved.prefix, ...argv], {
      cwd,
      env: cleanEnv(env),
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
  if (run.error || run.status === null) {
    return { status: null, stdout: run.stdout ?? "", stderr: run.stderr ?? "" };
  }
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

module.exports = { resolveAidd, runAidd, cmdLine, CMD_SAFE };
