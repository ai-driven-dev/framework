#!/usr/bin/env node
// PostToolUse hook — checks a file an agent just wrote under `cli/` with the same Biome check
// pre-commit runs, so a broken rule comes back in the same turn instead of at the next gate.
//
// Docs: https://code.claude.com/docs/en/hooks#posttooluse
//   stdin : JSON { tool_input: { file_path } }
//   exit 2: the Biome report on stderr, which Claude Code hands back to the agent
//   exit 0: silence — a clean file, one outside `cli/`, or no Biome installed to ask

const { spawnSync } = require("node:child_process");
const { existsSync, lstatSync, readFileSync } = require("node:fs");
const path = require("node:path");

const CLI = path.resolve(__dirname, "..", "..", "cli");
const WINDOWS = process.platform === "win32";
const BIOME = path.join(CLI, "node_modules", ".bin", WINDOWS ? "biome.cmd" : "biome");
const CHECKED = /\.(ts|mts|cts|js|mjs|cjs|json|jsonc)$/;

function writtenFile() {
  try {
    return JSON.parse(readFileSync(0, "utf8")).tool_input?.file_path ?? "";
  } catch {
    return "";
  }
}

function main() {
  const file = writtenFile();
  if (file === "" || !CHECKED.test(file) || !existsSync(file) || lstatSync(file).isSymbolicLink()) {
    return 0;
  }
  const relative = path.relative(CLI, path.resolve(file));
  if (relative.startsWith("..") || path.isAbsolute(relative)) return 0;
  if (relative.split(path.sep).includes("node_modules") || !existsSync(BIOME)) return 0;
  const result = spawnSync(BIOME, ["check", "--write", "--no-errors-on-unmatched", "--diagnostic-level=error", relative], {
    cwd: CLI,
    encoding: "utf8",
    shell: WINDOWS,
  });
  if (result.status === 0) return 0;
  process.stderr.write(`${result.stdout}${result.stderr}`);
  return 2;
}

process.exitCode = main();
