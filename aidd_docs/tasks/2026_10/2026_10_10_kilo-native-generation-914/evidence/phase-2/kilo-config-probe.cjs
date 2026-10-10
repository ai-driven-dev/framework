"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { prepareInstructionEdit } = require(path.resolve(__dirname, "../../../../../../plugins/aidd-context/skills/05-rule-generate/scripts/kilo-config.cjs"));

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "aidd-kilo-config-probe-")));
const instruction = ".kilo/rules/01-standards/1-naming.md";
function put(project, relative, content) {
  const file = path.join(project, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function digest(project) {
  const files = [];
  function walk(dir, prefix = "") {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = prefix + entry.name;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(absolute, relative + "/");
      else files.push(`${relative}:${createHash("sha256").update(fs.readFileSync(absolute)).digest("hex")}`);
    }
  }
  walk(project);
  return files;
}
function run(project) {
  const xdg = path.join(root, "xdg", path.basename(project));
  const env = { ...process.env, XDG_STATE_HOME: path.join(xdg, "state"), XDG_DATA_HOME: path.join(xdg, "data"), XDG_CONFIG_HOME: path.join(xdg, "config") };
  for (const name of ["state", "data", "config"]) fs.mkdirSync(path.join(xdg, name), { recursive: true });
  const before = digest(project);
  const parsed = JSON.parse(execFileSync("kilo", ["debug", "config", "--pure"], { cwd: project, env, encoding: "utf8", timeout: 30000 }));
  const after = digest(project);
  const changedPaths = after.filter((item) => !before.includes(item)).map((item) => item.split(":")[0]);
  const beforeRule = before.find((item) => item.startsWith(`${instruction}:`));
  const afterRule = after.find((item) => item.startsWith(`${instruction}:`));
  if (beforeRule !== afterRule) throw new Error("Kilo changed the rule fixture.");
  return { instructions: parsed.instructions || [], changedPaths, ruleUnchanged: true };
}
try {
  const order = path.join(root, "order");
  fs.mkdirSync(order);
  for (const [name, marker] of [
    ["kilo.json", "root-json.md"], ["kilo.jsonc", "root-jsonc.md"],
    [".kilo/kilo.json", "dot-json.md"], [".kilo/kilo.jsonc", "dot-jsonc.md"],
  ]) put(order, name, JSON.stringify({ instructions: [marker] }));
  const positive = path.join(root, "positive");
  const negative = path.join(root, "negative");
  for (const project of [positive, negative]) {
    fs.mkdirSync(project);
    put(project, instruction, "# Unique Kilo rule marker\n");
  }
  const positiveBase = '{// retained comment\n"url":"https://example.test/a//b",\n"instructions":["docs/old.md","docs/old.md",],\n}';
  const projected = prepareInstructionEdit(positiveBase, instruction);
  if (!projected.changed) throw new Error("Expected a projected JSONC edit.");
  put(positive, ".kilo/kilo.jsonc", projected.content);
  put(negative, ".kilo/kilo.jsonc", JSON.stringify({ instructions: [] }));
  const version = execFileSync("kilo", ["--version"], { encoding: "utf8", env: { ...process.env, XDG_STATE_HOME: path.join(root, "xdg-version-state"), XDG_DATA_HOME: path.join(root, "xdg-version-data"), XDG_CONFIG_HOME: path.join(root, "xdg-version-config") } }).trim();
  const report = { version, positiveProjectionChanged: projected.changed, fourConfigOrder: run(order), positive: run(positive), negative: run(negative) };
  if (version !== "7.8.8") throw new Error(`Unexpected Kilo version: ${version}`);
  if (JSON.stringify(report.fourConfigOrder.instructions) !== JSON.stringify(["root-json.md", "root-jsonc.md", "dot-jsonc.md", "dot-json.md"])) throw new Error("Unexpected four-config merge order.");
  if (!report.positive.instructions.includes(instruction) || report.negative.instructions.includes(instruction)) throw new Error("Positive/negative config witness failed.");
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
