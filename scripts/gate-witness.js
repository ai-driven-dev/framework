#!/usr/bin/env node
/**
 * Runs a gate unless this exact tree already passed it. The witness is keyed on everything a
 * gate reads from the checkout: the index, so `git add` and `git rm` count; unstaged edits to
 * tracked files; and untracked files git does not ignore. It is taken before the run and saved
 * only when the run is green and the tree is still the one it was taken on, so an edit made
 * while the gate ran is never signed off. The command's own exit code passes through.
 *
 * What follows `--` is one shell command line, run by the platform's shell everywhere: on
 * Windows only a shell can start `pnpm`, and a shell given separate arguments would re-split
 * them unquoted, so the caller quotes once and every platform reads the same line.
 *
 * Usage:
 *   node scripts/gate-witness.js <name> -- <command...>
 */
const { execFileSync, spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const USAGE_EXIT = 2;

function git(root, args, input) {
  return execFileSync("git", args, {
    cwd: root,
    input,
    maxBuffer: 1 << 30,
    stdio: ["pipe", "pipe", "ignore"],
  });
}

function treeKey(root, command) {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(command));
  hash.update(git(root, ["ls-files", "-s", "-z"]));
  hash.update(git(root, ["diff", "-z", "--no-ext-diff", "--binary"]));
  const untracked = git(root, ["ls-files", "-o", "--exclude-standard", "-z"])
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  if (untracked.length > 0) {
    hash.update(untracked.join("\0"));
    hash.update(git(root, ["hash-object", "--stdin-paths"], untracked.join("\n")));
  }
  return hash.digest("hex");
}

function readStamp(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function main() {
  const [name, separator, ...command] = process.argv.slice(2);
  if (!/^[\w-]+$/.test(name ?? "") || separator !== "--" || command.length === 0) {
    console.error("Usage: node scripts/gate-witness.js <name> -- <command...>");
    return USAGE_EXIT;
  }
  const root = git(process.cwd(), ["rev-parse", "--show-toplevel"]).toString("utf8").trim();
  const gitPath = git(root, ["rev-parse", "--git-path", `aidd-gate-witness/${name}`]);
  const stamp = path.resolve(root, gitPath.toString("utf8").trim());
  const before = treeKey(root, command);
  if (readStamp(stamp) === before) {
    console.log(`✓ ${name}: skipped, this exact tree already passed it.`);
    return 0;
  }
  const result = spawnSync(command.join(" "), { stdio: "inherit", shell: true });
  if (result.status !== 0) return result.status ?? 1;
  if (treeKey(root, command) !== before) {
    console.log(`${name}: passed, but the tree changed while it ran, so it is not stamped.`);
    return 0;
  }
  fs.mkdirSync(path.dirname(stamp), { recursive: true });
  fs.writeFileSync(stamp, before);
  return 0;
}

process.exitCode = main();
