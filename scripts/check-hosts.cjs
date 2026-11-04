#!/usr/bin/env node
// What each installed AI tool really loads of this checkout's plugins, as a table: asked of the
// tool itself where it can answer, read from the files its documentation says it loads where it
// cannot. Exits 1 when an installed tool misses something. Reads only; a tool's session opened to
// list its agents (Claude, Copilot) is killed before any model answers.
//
// Sources for each proof:
// https://code.claude.com/docs/en/plugins/cli-reference
// https://code.claude.com/docs/en/headless
// https://developers.openai.com/codex/cli/reference
// https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference
// https://opencode.ai/v2/docs/skills
// https://kilo.ai/docs/customize/skills
// https://cursor.com/docs/plugins#test-plugins-locally
const { spawn, spawnSync } = require("node:child_process");
const { existsSync, mkdtempSync, readdirSync, readFileSync } = require("node:fs");
const { homedir, tmpdir } = require("node:os");
const { basename, join, resolve } = require("node:path");

const MARKETPLACE = "aidd-framework";
const SESSION_TIMEOUT_MS = 60000;
const READS = 10;
const READ_PAUSE_MS = 2000;

const rootFlag = process.argv.indexOf("--root");
const root = rootFlag === -1 ? resolve(__dirname, "..") : resolve(process.argv[rootFlag + 1]);
// Neutral on purpose: a project's own settings, skills and agents would add to the answer.
const cwd = mkdtempSync(join(tmpdir(), "aidd-check-hosts-"));
const home = homedir();

function listNames(dir) {
  return existsSync(dir) ? readdirSync(dir) : [];
}

const plugins = listNames(join(root, "plugins")).filter((name) =>
  existsSync(join(root, "plugins", name, ".claude-plugin/plugin.json"))
);
const skills = plugins.flatMap((plugin) =>
  listNames(join(root, "plugins", plugin, "skills"))
    .filter((skill) => existsSync(join(root, "plugins", plugin, "skills", skill, "SKILL.md")))
    .map((skill) => ({ plugin, skill }))
);
const agents = plugins.flatMap((plugin) =>
  listNames(join(root, "plugins", plugin, "agents"))
    .filter((file) => file.endsWith(".md"))
    .map((file) => ({ plugin, agent: basename(file, ".md") }))
);

function run(binary, args) {
  const result = spawnSync(binary, args, { cwd, encoding: "utf8", timeout: SESSION_TIMEOUT_MS });
  return result.status === 0 ? result.stdout : null;
}

function installed(binary) {
  return spawnSync(binary, ["--version"], { cwd, stdio: "ignore" }).error === undefined;
}

function json(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function fileHolds(path, text) {
  return existsSync(path) && readFileSync(path, "utf8").includes(text);
}

/** A cell: `asked` when the tool answered, the files alone otherwise; the missing names decide. */
function count(expected, found, proof) {
  const missing = expected.filter((name) => !found.has(name));
  const tally = `${expected.length - missing.length}/${expected.length}`;
  if (missing.length > 0) {
    const shown = missing.slice(0, 3).join(", ") + (missing.length > 3 ? ", …" : "");
    return { status: "missing", text: `${tally}, missing ${shown}` };
  }
  return { status: proof, text: tally };
}

function instructions(path, proof = "files") {
  return fileHolds(path, "## Agents")
    ? { status: proof, text: path.replace(home, "~") }
    : { status: "missing", text: `no Agents block in ${path.replace(home, "~")}` };
}

/** Reads a tool's JSON lines until one is `done`, then kills it, so no model gets to answer. */
function firstLine(binary, args, done, input = []) {
  return new Promise((settle) => {
    const child = spawn(binary, args, { cwd, stdio: ["pipe", "pipe", "ignore"] });
    let buffer = "";
    const finish = (value) => {
      clearTimeout(timer);
      child.kill();
      settle(value);
    };
    const timer = setTimeout(() => finish(null), SESSION_TIMEOUT_MS);
    child.on("error", () => finish(null));
    child.on("close", () => finish(null));
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        const parsed = json(line);
        if (parsed !== null && done(parsed)) finish(parsed);
      }
    });
    for (const message of input) child.stdin.write(`${JSON.stringify(message)}\n`);
    if (input.length === 0) child.stdin.end();
  });
}

const qualified = ({ plugin, agent }) => `${plugin}:${agent}`;
const flat = ({ plugin, agent }) => `${plugin}-${agent}`;
const skillPath = ({ plugin, skill }) => `${plugin}/${skill}`;

/** Every `<plugin>/<skill>` a list of paths names, whatever comes before and after it. */
function skillsIn(paths) {
  const found = new Set();
  for (const path of paths) {
    const match = String(path).match(/(?:^|[\\/])([^\\/]+)[\\/](?:skills[\\/])?([^\\/]+)[\\/]SKILL\.md$/);
    const tail = String(path).match(/(?:^|[\\/])([^\\/]+)[\\/]skills[\\/]([^\\/]+)(?:[\\/]SKILL\.md)?$/);
    for (const hit of [match, tail]) if (hit !== null) found.add(`${hit[1]}/${hit[2]}`);
  }
  return found;
}

async function claude() {
  const configDir = process.env.CLAUDE_CONFIG_DIR || join(home, ".claude");
  const listed = json(run("claude", ["plugin", "list", "--json"]) ?? "") ?? [];
  const enabled = new Set(
    listed
      .filter((p) => p.enabled && p.scope === "user" && p.id?.endsWith(`@${MARKETPLACE}`))
      .map((p) => p.id.split("@")[0])
  );
  const skillCount = plugins.reduce((sum, plugin) => {
    const details = run("claude", ["plugin", "details", `${plugin}@${MARKETPLACE}`]) ?? "";
    return sum + Number(details.match(/Skills \((\d+)\)/)?.[1] ?? 0);
  }, 0);
  // `plugin details` prints Agents (0) for a manifest listing its agents by file; the session's
  // own init event names what it really loaded.
  const init = await firstLine(
    "claude",
    ["-p", "Reply OK", "--model", "haiku", "--max-turns", "1", "--output-format", "stream-json", "--verbose"],
    (event) => event.type === "system" && event.subtype === "init"
  );
  return {
    plugins: count(plugins, enabled, "asked"),
    instructions: instructions(join(configDir, "CLAUDE.md")),
    skills:
      skillCount === skills.length
        ? { status: "asked", text: `${skillCount}/${skills.length}` }
        : { status: "missing", text: `${skillCount}/${skills.length}` },
    agents: count(agents.map(qualified), new Set(init?.agents ?? []), "asked"),
  };
}

function promptText(value) {
  if (typeof value === "string") return "";
  if (Array.isArray(value)) return value.map(promptText).join("\n");
  if (value === null || typeof value !== "object") return "";
  return [typeof value.text === "string" ? value.text : "", promptText(value.content)].join("\n");
}

async function codex() {
  const codexHome = process.env.CODEX_HOME || join(home, ".codex");
  const listed = json(run("codex", ["plugin", "list", "--json"]) ?? "")?.installed ?? [];
  const enabled = new Set(
    listed.filter((p) => p.marketplaceName === MARKETPLACE && p.installed && p.enabled).map((p) => p.name)
  );
  const prompt = promptText(json(run("codex", ["debug", "prompt-input"]) ?? "") ?? []);
  const available = new Set(
    [...prompt.matchAll(/^- ([a-z0-9-]+):([^:\s]+)/gm)].map((hit) => `${hit[1]}/${hit[2]}`)
  );
  const loaded = prompt.includes("# AGENTS.md instructions") && prompt.includes("## Agents");
  return {
    plugins: count(plugins, enabled, "asked"),
    instructions: loaded
      ? { status: "asked", text: "in the prompt" }
      : { status: "missing", text: "not in the prompt" },
    skills: count(skills.map(skillPath), available, "asked"),
    agents: count(
      agents.map(flat),
      new Set(listNames(join(codexHome, "agents")).map((file) => basename(file, ".toml"))),
      "files"
    ),
  };
}

async function copilot() {
  const listed = json(run("copilot", ["plugin", "list", "--json"]) ?? "") ?? [];
  const enabled = new Set(
    listed.filter((p) => p.marketplace === MARKETPLACE && p.enabled).map((p) => p.name)
  );
  const sources = json(run("copilot", ["instruction", "list", "--json"]) ?? "") ?? [];
  const pluginSkills = (json(run("copilot", ["skill", "list", "--json"]) ?? "") ?? []).filter(
    (skill) => skill.source === "plugin" && skill.enabled
  );
  const session = await firstLine("copilot", ["--acp", "--no-auto-update"], (m) => m.id === 2, [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: 1, clientCapabilities: {} } },
    { jsonrpc: "2.0", id: 2, method: "session/new", params: { cwd, mcpServers: [] } },
  ]);
  const agentOption = session?.result?.configOptions?.find((option) => option.id === "agent");
  return {
    plugins: count(plugins, enabled, "asked"),
    instructions: sources.some((source) => source.sourcePath?.endsWith("copilot-instructions.md"))
      ? { status: "asked", text: "listed" }
      : { status: "missing", text: "not listed" },
    skills: count(skills.map(skillPath), skillsIn(pluginSkills.map((skill) => skill.path)), "asked"),
    agents: count(
      agents.map(qualified),
      new Set(agentOption?.options?.map((option) => option.value) ?? []),
      "asked"
    ),
  };
}

function pluginFolders(found) {
  return new Set([...found].map((path) => path.split("/")[0]));
}

async function opencode() {
  const configDir = (run("opencode", ["debug", "paths", "config"]) ?? "").trim();
  // Not --standalone: its private server answers an empty list before it has loaded. The service
  // does too while it starts cold, so a list counts once two reads in a row agree.
  let listed = [];
  for (let read = 0, previous = -1; read < READS; read += 1) {
    listed = json(run("opencode", ["api", "get", "/api/skill"]) ?? "")?.data ?? [];
    if (listed.length > 0 && listed.length === previous) break;
    previous = listed.length;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, READ_PAUSE_MS);
  }
  const found = skillsIn(listed.map((skill) => skill.path));
  const listedAgents = json(run("opencode", ["debug", "agents", "--standalone"]) ?? "") ?? [];
  return {
    plugins: count(plugins, pluginFolders(found), "asked"),
    instructions: instructions(join(configDir, "AGENTS.md")),
    skills: count(skills.map(skillPath), found, "asked"),
    agents: count(agents.map(flat), new Set(listedAgents.map((agent) => agent.id)), "asked"),
  };
}

async function kilo() {
  const listed = json(run("kilo", ["debug", "skill"]) ?? "") ?? [];
  const found = skillsIn(listed.map((skill) => skill.location));
  const loaded = agents.map(flat).filter((name) => run("kilo", ["debug", "agent", name]) !== null);
  return {
    plugins: count(plugins, pluginFolders(found), "asked"),
    // Kilo documents no global AGENTS.md, only its config's `instructions` key.
    instructions: { status: "none", text: "none documented" },
    skills: count(skills.map(skillPath), found, "asked"),
    agents: count(agents.map(flat), new Set(loaded), "asked"),
  };
}

async function cursor() {
  const local = join(home, ".cursor/plugins/local");
  const valid = plugins.filter(
    (plugin) => json(existsSync(join(local, plugin, ".cursor-plugin/plugin.json"))
      ? readFileSync(join(local, plugin, ".cursor-plugin/plugin.json"), "utf8")
      : "") !== null
  );
  const named = skills.filter(({ plugin, skill }) =>
    fileHolds(join(local, plugin, "skills", skill, "SKILL.md"), `name: ${skill}`)
      || fileHolds(join(local, plugin, "skills", skill, "SKILL.md"), `name: '${skill}'`)
  );
  const present = agents.filter(({ plugin, agent }) =>
    existsSync(join(local, plugin, "agents", `${agent}.md`))
  );
  return {
    plugins: count(plugins, new Set(valid), "files"),
    instructions: instructions(join(home, ".cursor/rules/aidd-agents.mdc")),
    skills: count(skills.map(skillPath), new Set(named.map(skillPath)), "files"),
    agents: count(agents.map(flat), new Set(present.map(flat)), "files"),
  };
}

const TOOLS = [
  { name: "Claude Code", binaries: ["claude"], check: claude },
  { name: "Codex", binaries: ["codex"], check: codex },
  { name: "Copilot", binaries: ["copilot"], check: copilot },
  { name: "Cursor", binaries: ["cursor-agent", "cursor"], check: cursor },
  { name: "Kilo", binaries: ["kilo"], check: kilo },
  { name: "OpenCode", binaries: ["opencode"], check: opencode },
];

const MARK = { asked: "✅", files: "🟡", missing: "❌", none: "➖" };

function show(cell) {
  return `${MARK[cell.status]} ${cell.text}`;
}

async function main() {
  console.log("| Tool | Plugins enabled | Global instructions | Skills | Agents |");
  console.log("| --- | --- | --- | --- | --- |");
  let failed = false;
  for (const tool of TOOLS) {
    if (!tool.binaries.some(installed)) {
      console.log(`| ${tool.name} | not installed | | | |`);
      continue;
    }
    const row = await tool.check();
    const cells = [row.plugins, row.instructions, row.skills, row.agents];
    if (cells.some((cell) => cell.status === "missing")) failed = true;
    console.log(`| ${tool.name} | ${cells.map(show).join(" | ")} |`);
  }
  console.log("\n✅ the tool says so · 🟡 the files its documentation says it loads · ❌ missing · ➖ does not apply");
  process.exit(failed ? 1 : 0);
}

main();
