#!/usr/bin/env node
// What each installed AI tool really loads of this checkout's plugins, as a table: asked of the
// tool itself where it can answer, read from the files its documentation says it loads where it
// cannot. Compares names, not contents. Exits 1 when an installed tool misses something, 2 when
// the checkout has no plugin to expect.
//
// Writes no setting. Listing agents opens a session that is killed as soon as it answers: Claude's
// (no hooks, no saved transcript) may have started one model request, whose answer nobody reads;
// Copilot's sends no prompt and leaves an entry in its session state.
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
const { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } = require("node:fs");
const { homedir, tmpdir } = require("node:os");
const { basename, join, resolve, sep } = require("node:path");

const MARKETPLACE = "aidd-framework";
const INSTRUCTIONS_MARKER = "<!-- aidd_global_instructions:start -->";
const SESSION_TIMEOUT_MS = 60000;
const READS = 15;
const READ_PAUSE_MS = 2000;

const rootFlag = process.argv.indexOf("--root");
const root = resolve(rootFlag === -1 ? join(__dirname, "..") : (process.argv[rootFlag + 1] ?? "."));
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

// Neutral on purpose: a project's own settings, skills and agents would add to the answer.
let cwd;

function run(binary, args) {
  const result = spawnSync(binary, args, {
    cwd,
    encoding: "utf8",
    timeout: SESSION_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
  });
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

function pause(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function fileHolds(path, text) {
  return existsSync(path) && readFileSync(path, "utf8").includes(text);
}

/** A markdown file's frontmatter alone, so a line of its body never counts. */
function frontmatter(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? null;
}

function field(block, key) {
  return block?.match(new RegExp(`^${key}:[ \\t]*["']?([^"'\\r\\n]*)`, "m"))?.[1].trim();
}

/** A cell: the proof it was given, unless a name is missing. */
function count(expected, found, proof) {
  const missing = expected.filter((name) => !found.has(name));
  const tally = `${expected.length - missing.length}/${expected.length}`;
  if (missing.length > 0) {
    const shown = missing.slice(0, 3).join(", ") + (missing.length > 3 ? ", …" : "");
    return { status: "missing", text: `${tally}, missing ${shown}` };
  }
  return { status: proof, text: tally };
}

function instructions(path) {
  const shown = path.replace(home, "~");
  return fileHolds(path, INSTRUCTIONS_MARKER)
    ? { status: "files", text: shown }
    : { status: "missing", text: `no managed block in ${shown}` };
}

/** Reads a tool's JSON lines until one is `done`, then kills it. */
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
    child.stdin.on("error", () => {});
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

const qualifiedAgent = ({ plugin, agent }) => `${plugin}:${agent}`;
const flatAgent = ({ plugin, agent }) => `${plugin}-${agent}`;
const skillId = ({ plugin, skill }) => `${plugin}/${skill}`;
const qualifiedSkill = ({ plugin, skill }) => `${plugin}:${skill}`;

/** The `<plugin>/<skill>` of a skill's path, `.../<plugin>/[skills/]<skill>[/SKILL.md]`. */
function skillIdOf(path) {
  const parts = String(path).split(/[\\/]/).filter((part) => part !== "SKILL.md");
  const skill = parts.pop();
  const parent = parts.pop();
  return `${parent === "skills" ? parts.pop() : parent}/${skill}`;
}

/** The skills a tool lists that are really there, under the directory it was installed in: a
 * stale list or a same-named skill elsewhere proves nothing. */
function skillsUnder(paths, dir) {
  return new Set(
    paths
      .map(String)
      .filter((path) => path.startsWith(dir + sep) && existsSync(path))
      .map(skillIdOf)
  );
}

function pluginsOf(found) {
  return new Set([...found].map((id) => id.split("/")[0]));
}

async function claude() {
  const configDir = process.env.CLAUDE_CONFIG_DIR || join(home, ".claude");
  const listed = json(run("claude", ["plugin", "list", "--json"]) ?? "") ?? [];
  const enabled = listed
    .filter((p) => p.enabled && p.scope === "user" && p.id?.endsWith(`@${MARKETPLACE}`))
    .map((p) => p.id.split("@")[0]);
  // `plugin details` prints Agents (0) for a manifest listing its agents by file; the session's
  // own init event names what it really loaded.
  const init = await firstLine(
    "claude",
    [
      "-p",
      "Reply OK",
      "--model",
      "haiku",
      "--max-turns",
      "1",
      "--no-session-persistence",
      "--settings",
      '{"disableAllHooks":true}',
      "--output-format",
      "stream-json",
      "--verbose",
    ],
    (event) => event.type === "system" && event.subtype === "init"
  );
  const loaded = new Set((init?.plugins ?? []).map((plugin) => plugin.name));
  return {
    plugins: count(plugins, new Set(enabled.filter((name) => loaded.has(name))), "asked"),
    instructions: instructions(join(configDir, "CLAUDE.md")),
    skills: count(skills.map(qualifiedSkill), new Set(init?.skills ?? []), "asked"),
    agents: count(agents.map(qualifiedAgent), new Set(init?.agents ?? []), "asked"),
  };
}

function promptText(value) {
  if (Array.isArray(value)) return value.map(promptText).join("\n");
  if (value === null || typeof value !== "object") return "";
  return [typeof value.text === "string" ? value.text : "", promptText(value.content)].join("\n");
}

async function codex() {
  const codexHome = process.env.CODEX_HOME || join(home, ".codex");
  const listed = json(run("codex", ["plugin", "list", "--json"]) ?? "")?.installed ?? [];
  const enabled = listed
    .filter((p) => p.marketplaceName === MARKETPLACE && p.installed && p.enabled)
    .map((p) => p.name);
  const prompt = promptText(json(run("codex", ["debug", "prompt-input"]) ?? "") ?? []);
  const available = [...prompt.matchAll(/^- ([a-z0-9-]+):([^:\s]+)/gm)].map(
    (hit) => `${hit[1]}/${hit[2]}`
  );
  const agentFiles = agents.map(flatAgent).filter((name) => {
    const path = join(codexHome, "agents", `${name}.toml`);
    return fileHolds(path, `name = "${name}"`) && fileHolds(path, "developer_instructions");
  });
  return {
    plugins: count(plugins, new Set(enabled), "asked"),
    instructions: prompt.includes(INSTRUCTIONS_MARKER)
      ? { status: "asked", text: "in the prompt" }
      : { status: "missing", text: "not in the prompt" },
    skills: count(skills.map(skillId), new Set(available), "asked"),
    agents: count(agents.map(flatAgent), new Set(agentFiles), "files"),
  };
}

async function copilot() {
  const listed = json(run("copilot", ["plugin", "list", "--json"]) ?? "") ?? [];
  const enabled = listed
    .filter((p) => p.marketplace === MARKETPLACE && p.enabled)
    .map((p) => p.name);
  const sources = json(run("copilot", ["instruction", "list", "--json"]) ?? "") ?? [];
  const managed = sources.some(
    (source) =>
      source.sourcePath?.endsWith("copilot-instructions.md") &&
      fileHolds(source.sourcePath, INSTRUCTIONS_MARKER)
  );
  const pluginSkills = (json(run("copilot", ["skill", "list", "--json"]) ?? "") ?? []).filter(
    (skill) => skill.source === "plugin" && skill.enabled
  );
  const session = await firstLine("copilot", ["--acp", "--no-auto-update"], (m) => m.id === 2, [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: 1, clientCapabilities: {} },
    },
    { jsonrpc: "2.0", id: 2, method: "session/new", params: { cwd, mcpServers: [] } },
  ]);
  const agentOption = session?.result?.configOptions?.find((option) => option.id === "agent");
  return {
    plugins: count(plugins, new Set(enabled), "asked"),
    instructions: managed
      ? { status: "asked", text: "listed" }
      : { status: "missing", text: "no managed copilot-instructions.md listed" },
    skills: count(
      skills.map(skillId),
      new Set(
        pluginSkills.filter((skill) => existsSync(String(skill.path))).map((s) => skillIdOf(s.path))
      ),
      "asked"
    ),
    agents: count(
      agents.map(qualifiedAgent),
      new Set(agentOption?.options?.map((option) => option.value) ?? []),
      "asked"
    ),
  };
}

async function opencode() {
  const configDir = (run("opencode", ["debug", "paths", "config"]) ?? "").trim();
  if (configDir === "") {
    const silent = { status: "missing", text: "no config directory answered" };
    return { plugins: silent, instructions: silent, skills: silent, agents: silent };
  }
  // Not --standalone: its private server answers an empty list before it has loaded. The service
  // does too while it starts cold, so the list is read again until it holds every skill or the
  // reads run out: a late answer costs a pause, never a wrong cell.
  const expected = skills.map(skillId);
  let found = new Set();
  for (let read = 0; read < READS; read += 1) {
    const listed = json(run("opencode", ["api", "get", "/api/skill"]) ?? "")?.data ?? [];
    found = skillsUnder(
      listed.map((skill) => skill.path),
      join(configDir, "skills")
    );
    if (expected.every((id) => found.has(id))) break;
    if (read < READS - 1) pause(READ_PAUSE_MS);
  }
  const listedAgents = json(run("opencode", ["debug", "agents", "--standalone"]) ?? "") ?? [];
  return {
    plugins: count(plugins, pluginsOf(found), "asked"),
    instructions: instructions(join(configDir, "AGENTS.md")),
    skills: count(expected, found, "asked"),
    agents: count(agents.map(flatAgent), new Set(listedAgents.map((agent) => agent.id)), "asked"),
  };
}

async function kilo() {
  const configDir = (run("kilo", ["debug", "paths"]) ?? "").match(/^config\s+(.+)$/m)?.[1]?.trim();
  const listed = json(run("kilo", ["debug", "skill"]) ?? "") ?? [];
  const found = skillsUnder(
    listed.map((skill) => skill.location),
    join(configDir ?? join(home, ".config/kilo"), "skills")
  );
  const loaded = agents.map(flatAgent).filter((name) => run("kilo", ["debug", "agent", name]) !== null);
  return {
    plugins: count(plugins, pluginsOf(found), "asked"),
    // Kilo documents no global AGENTS.md, only its config's `instructions` key.
    instructions: { status: "none", text: "none documented" },
    skills: count(skills.map(skillId), found, "asked"),
    agents: count(agents.map(flatAgent), new Set(loaded), "asked"),
  };
}

async function cursor() {
  const local = join(home, ".cursor/plugins/local");
  const valid = plugins.filter((plugin) => {
    const path = join(local, plugin, ".cursor-plugin/plugin.json");
    return existsSync(path) && json(readFileSync(path, "utf8")) !== null;
  });
  const conforming = skills.filter(({ plugin, skill }) => {
    const block = frontmatter(join(local, plugin, "skills", skill, "SKILL.md"));
    return field(block, "name") === skill && Boolean(field(block, "description"));
  });
  const present = agents.filter(({ plugin, agent }) =>
    Boolean(field(frontmatter(join(local, plugin, "agents", `${agent}.md`)), "description"))
  );
  return {
    plugins: count(plugins, new Set(valid), "files"),
    instructions: instructions(join(home, ".cursor/rules/aidd-agents.mdc")),
    skills: count(skills.map(skillId), new Set(conforming.map(skillId)), "files"),
    agents: count(agents.map(flatAgent), new Set(present.map(flatAgent)), "files"),
  };
}

/** `agent` is Cursor's only when its help says so: other tools take that name. */
function cursorInstalled() {
  if (installed("cursor-agent") || installed("cursor")) return true;
  return (run("agent", ["--help"]) ?? "").includes("Start the Cursor Agent");
}

const TOOLS = [
  { name: "Claude Code", present: () => installed("claude"), check: claude },
  { name: "Codex", present: () => installed("codex"), check: codex },
  { name: "Copilot", present: () => installed("copilot"), check: copilot },
  { name: "Cursor", present: cursorInstalled, check: cursor },
  { name: "Kilo", present: () => installed("kilo"), check: kilo },
  { name: "OpenCode", present: () => installed("opencode"), check: opencode },
];

const MARK = { asked: "✅", files: "🟡", missing: "❌", none: "➖" };

function show(cell) {
  return `${MARK[cell.status]} ${cell.text}`;
}

async function main() {
  if (plugins.length === 0) {
    console.error(`No plugin to expect under ${root}.`);
    return 2;
  }
  console.log("| Tool | Plugins enabled | Global instructions | Skills | Agents |");
  console.log("| --- | --- | --- | --- | --- |");
  let failed = false;
  for (const tool of TOOLS) {
    if (!tool.present()) {
      console.log(`| ${tool.name} | not installed | | | |`);
      continue;
    }
    const row = await tool.check();
    const cells = [row.plugins, row.instructions, row.skills, row.agents];
    if (cells.some((cell) => cell.status === "missing")) failed = true;
    console.log(`| ${tool.name} | ${cells.map(show).join(" | ")} |`);
  }
  console.log(
    "\n✅ the tool says so · 🟡 the files its documentation says it loads · ❌ missing · ➖ does not apply"
  );
  return failed ? 1 : 0;
}

cwd = mkdtempSync(join(tmpdir(), "aidd-check-hosts-"));
main().then((code) => {
  rmSync(cwd, { recursive: true, force: true });
  process.exit(code);
});
