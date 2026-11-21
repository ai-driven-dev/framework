const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const PLUGIN = path.resolve(__dirname, "../../plugins/aidd-context");
const SKILL = path.join(PLUGIN, "skills/02-project-memory");
const { lintFile } = require(path.join(PLUGIN, "skills/02-project-memory/scripts/lib/memory-lint.cjs"));
const { RULES } = require(path.join(PLUGIN, "skills/02-project-memory/scripts/lib/memory-rules.cjs"));

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

test("the Kilo memory row lists native project signals and the shared context target", () => {
  const { header, rows } = tableOf(path.join(SKILL, "references/tools.md"));
  const detectedAt = header.indexOf("Detected when");
  const contextAt = header.indexOf("Context file");
  const kilo = rows.find(([tool]) => tool.replaceAll("`", "") === "kilo");

  assert.ok(kilo, "the tools table has no Kilo row");
  assert.notEqual(detectedAt, -1, "the tools table has no detection column");
  assert.notEqual(contextAt, -1, "the tools table has no context target column");
  const signals = kilo[detectedAt].replaceAll("`", "");
  for (const signal of [".kilo/", "kilo.json", "kilo.jsonc", ".kilo/kilo.json", ".kilo/kilo.jsonc", ".kilocode/"]) {
    assert.ok(signals.includes(signal), `the Kilo row omits ${signal}`);
  }
  assert.equal(kilo[contextAt].replaceAll("`", "").trim(), "AGENTS.md");
});

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

test("no skill text names the hook's engine, a node command line, or a path outside the skill", () => {
  const forbidden = /(?<![\w-])memory\.cjs\b|`node [^`]*`|\$\{CLAUDE_[A-Z_]+\}|\]\(\.\.\/\.\.\/[^)]*\)/u;
  for (const file of skillMarkdown()) {
    const hit = fs.readFileSync(file, "utf8").match(forbidden);
    assert.equal(hit, null, `${path.relative(SKILL, file)}: ${hit?.[0]}`);
  }
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

test("the plan shows each changed line as a diff, and a question apart from the yes and no items", () => {
  const read = fs.readFileSync(path.join(SKILL, "actions/01-read.md"), "utf8");
  assert.match(read, /`diff` block/u, "a bank change is not shown in a diff block");
  assert.match(read, /`- ` lines? quoting/u, "a replaced or removed line is not quoted as a `- ` line");
  assert.match(read, /`\+ ` lines?/u, "a replacement is not shown as a `+ ` line");
  assert.match(read, /file to remove\b.*every line/iu, "a removed file can be summarized instead of quoted");
  assert.match(read, /questions? .*apart/iu, "the questions are not set apart from the numbered items");
  assert.match(read, /`ok` .*never .*question/iu, "an `ok` can still answer a question");
});

test("wiring leaves the blocks to update themselves and never reports them stale", () => {
  const wire = fs.readFileSync(path.join(SKILL, "actions/03-wire.md"), "utf8");
  assert.match(wire, /session start and (?:at )?(?:each )?turn end/iu, "the wire action does not say when the blocks update");
  assert.match(wire, /never report/iu, "the wire action lets a block be reported stale");
});
