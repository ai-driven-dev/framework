const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const PLUGIN = path.resolve(__dirname, "../../plugins/aidd-context");
const SKILL = path.join(PLUGIN, "skills/02-project-memory");
const { lintFile } = require(path.join(PLUGIN, "hooks/memory.cjs"));
const { RULES } = require(path.join(PLUGIN, "hooks/lib/memory-rules.cjs"));

const CAPABILITIES = [
  ...Array(6).fill("core"),
  ...["ecosystem", "backlog", "deployment", "api", "cli", "package", "auth", "database", "data", "messaging", "realtime", "ui", "mobile", "desktop"],
];
const HEADER = ["Capability", "File", "Meaning", "Detected when", "Always", "Accepted names"];
const { UNFINISHED } = require("./helpers/unfinished-marker.js");

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

function skillMarkdown() {
  return filesUnder(SKILL).filter((file) => file.endsWith(".md"));
}

/** The first table of a file: the rows of its first run of `|` lines. */
function tableOf(file) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/u);
  const first = lines.findIndex((line) => line.startsWith("|"));
  const run = lines.slice(first);
  const rows = run
    .slice(0, run.findIndex((line) => !line.startsWith("|")) < 0 ? run.length : run.findIndex((line) => !line.startsWith("|")))
    .filter((line) => !/^\|[\s|:-]+\|$/u.test(line))
    .map((line) => line.replace(/^\||\|$/gu, "").split("|").map((cell) => cell.trim()));
  return { header: rows[0], rows: rows.slice(1) };
}

test("the README template is finished and passes the memory engine under another name", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "readme-probe-"));
  try {
    const bank = path.join(root, "aidd_docs/memory");
    fs.mkdirSync(bank, { recursive: true });
    fs.copyFileSync(path.join(SKILL, "assets/templates/README.md"), path.join(bank, "readme-probe.md"));
    const errors = lintFile(root, "aidd_docs/memory/readme-probe.md").filter((problem) => problem.severity === "error");
    assert.deepEqual(errors, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  const text = fs.readFileSync(path.join(SKILL, "assets/templates/README.md"), "utf8");
  assert.doesNotMatch(text, UNFINISHED, "a placeholder or a guidance comment is left");
  for (const link of ["GUIDES.md", "CONCEPTS.md", "#get-started"]) assert.ok(text.includes(link), `no link to ${link}`);
});

test("an autolink is not an unfinished marker, a placeholder is", () => {
  assert.doesNotMatch("See <https://example.com/guide> for more.", UNFINISHED);
  assert.match("<your team rule here>", UNFINISHED);
  assert.match("{{a question}}", UNFINISHED);
  assert.match("<!-- guidance -->", UNFINISHED);
});

test("the team templates are not shipped", () => {
  for (const name of ["GUIDELINES.md", "CONTRIBUTING.md", "memory/README.md"]) {
    assert.equal(fs.existsSync(path.join(SKILL, "assets/templates", name)), false, name);
  }
});

test("capabilities.md holds one row per file, and every memory template belongs to a row", () => {
  const { header, rows } = tableOf(path.join(SKILL, "references/capabilities.md"));
  assert.deepEqual(header, HEADER);
  assert.deepEqual(rows.map(([capability]) => capability.replace(/`/gu, "")), CAPABILITIES);
  for (const cells of rows) assert.ok(cells[HEADER.indexOf("Meaning")] !== "" && cells[HEADER.indexOf("Detected when")] !== "", `${cells[0]} lacks its meaning or detection`);
  const named = rows.map((cells) => cells[HEADER.indexOf("File")]).join(" ");
  const templates = filesUnder(path.join(SKILL, "assets/templates/memory")).map((file) => path.basename(file));
  for (const template of templates) assert.ok(named.includes(template), `${template} belongs to no capability row`);
});

function skillText(file) {
  return fs.readFileSync(path.join(SKILL, file), "utf8");
}

const FIXTURES = path.resolve(__dirname, "../../cli/tests/fixtures/hooks-routes");
const PLUGIN_HOOKS = /^(?:[^/]+\/)*plugins\/aidd-context\/hooks\/memory\.cjs$/u;
const TOOL_HOOKS = /^(?:[^/]+\/)*\.[a-z]+\/hooks\/aidd-context\/memory\.cjs$/u;

function section(text, heading) {
  const start = text.indexOf(`## ${heading}`);
  assert.ok(start >= 0, `no ${heading} section`);
  const rest = text.slice(start + 3);
  const end = rest.search(/\n## /u);
  return end < 0 ? rest : rest.slice(0, end);
}

function engineSection() {
  return skillText("references/engine.md");
}

test("the lint command the skill gives takes the root first, and exits 1 on a planted unfinished marker", () => {
  const given = engineSection().match(/`node memory\.cjs check (\.) (aidd_docs\/memory\/<file>\.md)`/u);
  assert.ok(given, "the engine reference gives no `node memory.cjs check . aidd_docs/memory/<file>.md`");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lint-command-"));
  try {
    fs.mkdirSync(path.join(root, "aidd_docs/memory"), { recursive: true });
    const template = fs.readFileSync(path.join(SKILL, "assets/templates/memory/vcs.md"), "utf8");
    fs.writeFileSync(path.join(root, "aidd_docs/memory/vcs.md"), `# VCS\n\n- ${template.match(/\{\{[^{}\n]*\}\}/u)[0]}\n`);
    const run = (file) =>
      spawnSync("node", [path.join(PLUGIN, "hooks/memory.cjs"), "check", given[1], file.replace("<file>", "vcs")], {
        cwd: root,
        encoding: "utf8",
      });
    const result = run(given[2]);
    assert.equal(result.status, 1, `${result.stdout}${result.stderr}`);
    assert.match(result.stdout, /M3/u);
    // The mistake this guards: the file first reads as the root, finds nothing, and exits 0.
    const swapped = spawnSync("node", [path.join(PLUGIN, "hooks/memory.cjs"), "check", "aidd_docs/memory/vcs.md"], { cwd: root, encoding: "utf8" });
    assert.equal(swapped.status, 1, "the engine no longer passes silently on a file given as the root");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the Engine section matches the install layouts the hook fixtures show", () => {
  const engine = engineSection();
  const delivered = [];
  for (const tool of fs.readdirSync(FIXTURES)) {
    for (const scenario of fs.readdirSync(path.join(FIXTURES, tool))) {
      const lines = fs.readFileSync(path.join(FIXTURES, tool, scenario), "utf8").split(/\r?\n/u);
      for (const line of lines) {
        if (!line.startsWith("## ") || !line.endsWith("memory.cjs")) continue;
        const where = line.slice(3);
        assert.ok(PLUGIN_HOOKS.test(where) || TOOL_HOOKS.test(where), `${tool}/${scenario}: ${where} fits no layout the Engine section states`);
        delivered.push(`${tool}/${scenario}`);
      }
    }
  }
  assert.ok(delivered.length > 20, "the fixtures hold too few engine deliveries to compare");
  // Kilo and OpenCode have no native build: every route of theirs that installs the plugin ships
  // the engine and its libraries in the tool's folder.
  for (const tool of ["kilo", "opencode"]) {
    assert.match(fs.readFileSync(path.join(FIXTURES, tool, "native-build.txt"), "utf8"), /^route not supported by this tool$/mu, `${tool} now has a native build`);
    for (const route of ["flat-translate", "plugin-install", "plugin-install-twice", "setup-plugins-reinstall"]) {
      const shipped = fs.readFileSync(path.join(FIXTURES, tool, `${route}.txt`), "utf8");
      for (const file of ["memory.cjs", "lib/common-rules.cjs", "lib/memory-rules.cjs", "lib/host.cjs"]) {
        assert.match(shipped, new RegExp(`^## \\S+/\\.${tool}/hooks/aidd-context/${file.replace(".", "\\.")}$`, "mu"), `${tool}/${route} does not ship ${file}`);
      }
    }
  }
  assert.match(engine, /hooks\/aidd-context\//u, "no tool-folder layout");
  assert.match(engine, /at the project root/u, "the tool-folder layout is not anchored at the project root, where a flat install puts the hooks apart from the skills");
  assert.match(engine, /plugin's `hooks\/`/u, "no plugin layout");
  assert.match(engine, /inside this skill/u, "no skill-own layout");
  const order = ["plugin's `hooks/`", "hooks/aidd-context/", "inside this skill"].map((needle) => engine.indexOf(needle));
  assert.deepEqual([...order].sort((a, b) => a - b), order, "the lookup order is not plugin, tool folder, skill");
});

const TABLE_FIRST_FILES = () => skillMarkdown().filter((file) => !path.relative(SKILL, file).startsWith("assets"));

/** The prose paragraphs of a markdown text that hold several sentences, as `line: start`. */
function proseWithSeveralSentences(text) {
  const found = [];
  let fence = false;
  let front = false;
  let current = [];
  const flush = () => {
    const prose = current.map(({ line }) => line).join(" ").replace(/`[^`]*`/gu, "X").replace(/\[[^\]]*\]\([^)]*\)/gu, "L");
    if ((prose.match(/[.!?](?:\s|$)/gu) ?? []).length > 1) found.push(`${current[0].number}: ${current[0].line.slice(0, 60)}`);
    current = [];
  };
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    if (index === 0 && line === "---") front = true;
    else if (front && line === "---") {
      front = false;
      continue;
    }
    if (front) continue;
    if (line.startsWith("```")) {
      flush();
      fence = !fence;
      continue;
    }
    if (fence) continue;
    if (line.trim() === "" || /^(?:\||#|>|[-*+]\s|\d+[.)]\s|\s)/u.test(line)) {
      flush();
      continue;
    }
    current.push({ number: index + 1, line });
  }
  flush();
  return found;
}

test("the table-first guard sees a prose paragraph of several sentences and a sentence over the engine's limit", () => {
  assert.equal(proseWithSeveralSentences("One sentence here.\nIt goes on.\n").length, 1);
  assert.equal(proseWithSeveralSentences("One sentence only.\n\n- A list. With two.\n| a. | b. |\n").length, 0);
  const m1 = RULES.find((rule) => rule.id === "M1");
  assert.equal(m1.check({ file: "x.md", text: `${"word ".repeat(30)}end.\n` }).length, 1);
});

test("the skill's own markdown is table-first: no sentence the engine's M1 flags, no prose paragraph of several sentences", () => {
  const m1 = RULES.find((rule) => rule.id === "M1");
  for (const file of TABLE_FIRST_FILES()) {
    const name = path.relative(SKILL, file);
    const text = fs.readFileSync(file, "utf8");
    assert.deepEqual(m1.check({ file: name, text }).map(({ line, message }) => `${name}:${line} ${message}`), []);
    assert.deepEqual(proseWithSeveralSentences(text).map((where) => `${name}:${where}`), [], `${name} holds a prose paragraph of several sentences: make it a table or a list`);
  }
});

test("a recall case seeds a repo and expects the facts the restored slots must produce", () => {
  const cases = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../skill-eval/cases.json"), "utf8"));
  const recall = cases.find((entry) => entry.skill === "02-project-memory" && /recall/u.test(entry.name));
  assert.ok(recall, "no recall case for 02-project-memory");
  const files = Object.keys(recall.setup.files);
  assert.ok(files.some((name) => name.endsWith(".int.test.ts")), "the seeded repo has no test suffix convention");
  assert.ok(files.includes(".env.example"), "the seeded repo declares no environment variables");
  assert.ok(!files.some((name) => /CONTRIBUTING/u.test(name)), "the seeded repo carries a contributing file");
  const expected = recall.expect.fileContains;
  for (const [file, facts] of Object.entries({
    "aidd_docs/memory/testing.md": [".int.test.ts"],
    "aidd_docs/memory/architecture.md": [".env.example"],
    "aidd_docs/memory/ui.md": ["src/router.tsx"],
    "aidd_docs/memory/project-brief.md": ["export-invoices"],
  })) {
    for (const fact of facts) assert.ok(expected[file]?.includes(fact), `the recall case does not expect ${fact} in ${file}`);
    for (const fact of facts) assert.ok(JSON.stringify(recall.setup.files).includes(fact), `${fact} is not in the seeded repo`);
  }
  // The narrowest-run slot accepts one test file or a changed-only run: expect the slot answered, not one answer.
  assert.ok(expected["aidd_docs/memory/testing.md"]?.includes("Narrowest run: `"), "the recall case does not expect the narrowest run answered");
});

// Every command the engine reference gives is one the engine runs.
test("each engine command the skill names is one the engine accepts", () => {
  const usage = spawnSync("node", [path.join(PLUGIN, "hooks/memory.cjs")], { encoding: "utf8" }).stderr;
  const named = [...skillText("references/engine.md").matchAll(/`node memory\.cjs (\w+)/gu)].map((match) => match[1]);
  assert.ok(named.length > 0, "the reference names no command");
  for (const command of new Set(named)) assert.match(usage, new RegExp(`\\b${command}\\b`, "u"), command);
});
