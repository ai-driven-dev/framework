const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const PLUGIN = path.resolve(__dirname, "../../plugins/aidd-context");
const SKILL = path.join(PLUGIN, "skills/02-project-memory");
const { lintFile } = require(path.join(PLUGIN, "hooks/memory-lint.cjs"));
const CASES = path.resolve(__dirname, "../skill-eval/cases.json");

const CAPABILITIES = [
  "core", "ecosystem", "backlog", "ui", "api", "database", "auth", "realtime", "messaging",
  "deployment", "infra", "mobile", "desktop", "package", "cli", "data",
];
const HEADER = ["Capability", "Detected when", "File", "Always", "Former files"];
const DROPPED_TEMPLATES = /GUIDELINES|CONTRIBUTING|memory\/README/u;
const MERGED_REFERENCES = /capability-signals|memory-destinations|structure\.md/u;

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

function skillMarkdown() {
  return filesUnder(SKILL).filter((file) => file.endsWith(".md"));
}

function tableOf(file) {
  const rows = fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("|") && !/^\|[\s|:-]+\|$/u.test(line))
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
  assert.doesNotMatch(text, /\{\{|<!--/u, "a placeholder or a guidance comment is left");
  for (const link of ["GUIDES.md", "CONCEPTS.md", "#get-started"]) assert.ok(text.includes(link), `no link to ${link}`);
});

test("the team templates are not shipped", () => {
  for (const name of ["GUIDELINES.md", "CONTRIBUTING.md", "memory/README.md"]) {
    assert.equal(fs.existsSync(path.join(SKILL, "assets/templates", name)), false, name);
  }
});

test("no file of the skill names a dropped template or a merged reference", () => {
  for (const file of skillMarkdown()) {
    const text = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(text, DROPPED_TEMPLATES, `${path.relative(SKILL, file)} names a dropped template`);
    assert.doesNotMatch(text, MERGED_REFERENCES, `${path.relative(SKILL, file)} names a merged reference`);
  }
});

test("capabilities.md holds one row per capability, and every memory template belongs to a row", () => {
  const { header, rows } = tableOf(path.join(SKILL, "references/capabilities.md"));
  assert.deepEqual(header, HEADER);
  assert.deepEqual(rows.map(([capability]) => capability.replace(/`/gu, "")), CAPABILITIES);
  const named = rows.map((cells) => cells[HEADER.indexOf("File")]).join(" ");
  const templates = filesUnder(path.join(SKILL, "assets/templates/memory")).map((file) => path.basename(file));
  for (const template of templates) assert.ok(named.includes(template), `${template} belongs to no capability row`);
});

test("the eval cases expect none of the dropped files", () => {
  const text = fs.readFileSync(CASES, "utf8");
  const setup = JSON.parse(text).find((item) => item.name === "setup writes the bank to its destinations");
  assert.deepEqual(setup.expect.filesAbsent.sort(), [
    "aidd_docs/CONTRIBUTING.md",
    "aidd_docs/GUIDELINES.md",
    "aidd_docs/memory/README.md",
  ]);
  assert.ok(setup.expect.filesExist.includes("aidd_docs/README.md"));
  assert.doesNotMatch(JSON.stringify(setup.expect.fileContains), /GUIDELINES|CONTRIBUTING|must follow here/u);
});
