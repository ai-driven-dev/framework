#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-claude-scope-"));
const project = path.join(root, "project-a");
const otherProject = path.join(root, "project-b");
const home = path.join(root, "home");
const env = { ...process.env, HOME: home, CLAUDE_CONFIG_DIR: path.join(home, ".claude") };

function run(args) {
  const result = spawnSync("claude", args, { cwd: project, env, encoding: "utf8", timeout: 120000 });
  if (result.error || result.status !== 0) {
    throw new Error(`claude ${args.join(" ")} failed: ${result.stderr || result.error?.message || result.status}`);
  }
}

try {
  fs.mkdirSync(project, { recursive: true });
  fs.mkdirSync(otherProject, { recursive: true });
  run(["plugin", "marketplace", "add", process.cwd(), "--scope", "local"]);
  run(["plugin", "install", "aidd-context@aidd-framework", "--yes", "--scope", "local"]);

  const settings = path.join(project, ".claude", "settings.local.json");
  if (!fs.existsSync(settings)) throw new Error("project scope wrote no .claude/settings.local.json");
  const enabled = JSON.parse(fs.readFileSync(settings, "utf8")).enabledPlugins;
  if (enabled?.["aidd-context@aidd-framework"] !== true) {
    throw new Error("project settings do not enable aidd-context@aidd-framework");
  }
  if (fs.existsSync(path.join(otherProject, ".claude", "settings.local.json"))) {
    throw new Error("a second project received the local plugin settings");
  }
  console.log("Claude project-scope install is isolated: project A enabled, project B untouched.");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
