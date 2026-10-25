#!/usr/bin/env node
// Keeps the framework release version in the startup greeting in sync with the
// release itself. The greeting lives in the framework's own agent files
// (AGENTS.md, CLAUDE.md, cli/CLAUDE.md) and in the usage template shipped to
// user projects (plugins/aidd-context/skills/02-project-memory/assets/templates/AGENTS.md).
// The version source is .claude-plugin/marketplace.json, the framework release
// version as cut on the next branch. `--check` reports instead of writing.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const rootFlag = args.indexOf("--root");
const ROOT =
  rootFlag !== -1
    ? resolve(args[rootFlag + 1])
    : fileURLToPath(new URL("..", import.meta.url));
const CHECK = args.includes("--check");

const MANIFEST = `${ROOT}/.claude-plugin/marketplace.json`;

const TARGETS = [
  "AGENTS.md",
  "CLAUDE.md",
  "cli/CLAUDE.md",
  "plugins/aidd-context/skills/02-project-memory/assets/templates/AGENTS.md",
];

const GREETING_LINE = /greet/iu;
const STAMPED_VERSION = /Framework v\d+\.\d+\.\d+/u;

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const version = manifest.version;
if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/u.test(version)) {
  console.error(`❌ unexpected framework version in .claude-plugin/marketplace.json: ${String(version)}`);
  process.exit(1);
}

const stamped = `Framework v${version}`;
const touched = [];

for (const target of TARGETS) {
  const file = `${ROOT}/${target}`;
  if (!existsSync(file)) {
    console.error(`❌ missing greeting target: ${target}`);
    process.exit(1);
  }
  const before = readFileSync(file, "utf8");
  let found = false;
  const after = before
    .split("\n")
    .map((line) => {
      if (!GREETING_LINE.test(line) || !STAMPED_VERSION.test(line)) return line;
      found = true;
      return line.replace(STAMPED_VERSION, stamped);
    })
    .join("\n");
  if (!found) {
    console.error(`❌ no stamped greeting in ${target}`);
    process.exit(1);
  }
  if (after !== before) {
    touched.push(target);
    if (!CHECK) writeFileSync(file, after);
  }
}

if (touched.length === 0) {
  process.exit(0);
}

if (CHECK) {
  console.error(`❌ greeting version is stale in: ${touched.join(", ")}. Run: node scripts/sync-greeting-version.mjs`);
  process.exit(1);
}

console.log(`greeting version synced to v${version} in ${touched.length} file(s).`);
