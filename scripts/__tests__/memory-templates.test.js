const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const PLUGIN = path.resolve(__dirname, "../../plugins/aidd-context");
const SKILL = path.join(PLUGIN, "skills/02-project-memory");
const TEMPLATES = path.join(SKILL, "assets/templates/memory");
const { PLACEHOLDER } = require("./helpers/unfinished-marker.js");
const { lintFile } = require(path.join(PLUGIN, "hooks/memory.cjs"));

const ALWAYS = ["project-brief.md", "architecture.md", "codebase-map.md", "coding-assertions.md", "testing.md", "vcs.md", "ecosystem.md"];
const CONDITIONAL = [
  "backlog.md", "deployment.md", "api.md", "cli.md", "package.md", "auth.md", "database.md", "data.md",
  "messaging.md", "realtime.md", "ui.md", "mobile.md", "desktop.md",
];
const MERGED_NAMES = /\b(?:contract|native|async)\.md\b/u;

function templateFiles() {
  return fs.readdirSync(TEMPLATES, { withFileTypes: true }).flatMap((dir) =>
    dir.isDirectory() ? fs.readdirSync(path.join(TEMPLATES, dir.name)).map((name) => ({ capability: dir.name, name })) : []
  );
}

function textOf({ capability, name }) {
  return fs.readFileSync(path.join(TEMPLATES, capability, name), "utf8");
}

function capabilityRows() {
  return fs
    .readFileSync(path.join(SKILL, "references/capabilities.md"), "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("| `"))
    .map((line) => line.replace(/^\||\|$/gu, "").split("|").map((cell) => cell.trim()));
}

test("the templates are the twenty files, seven always written and thirteen conditional", () => {
  assert.deepEqual(templateFiles().map(({ name }) => name).sort(), [...ALWAYS, ...CONDITIONAL].sort());
});

test("no template or table names a merged file, and the data store and the datasets are two templates", () => {
  for (const template of templateFiles()) assert.doesNotMatch(textOf(template), MERGED_NAMES, template.name);
  assert.doesNotMatch(fs.readFileSync(path.join(SKILL, "references/capabilities.md"), "utf8"), MERGED_NAMES);
  assert.match(textOf({ capability: "database", name: "database.md" }), /^# Database$/mu);
  assert.match(textOf({ capability: "data", name: "data.md" }), /^# Data$/mu);
});

test("ecosystem holds the outside-service questions, and codebase-map the areas, entry points and packages", () => {
  const ecosystem = textOf({ capability: "ecosystem", name: "ecosystem.md" });
  assert.match(ecosystem, /\{\{Which external services does the project call[^}]*\}\}/u);
  const map = textOf({ capability: "core", name: "codebase-map.md" });
  for (const heading of ["Areas", "Entry points", "Packages"]) assert.match(map, new RegExp(`^## ${heading}$`, "mu"));
  assert.doesNotMatch(textOf({ capability: "core", name: "architecture.md" }), /Entry points|Packages:/u);
});

test("each template gives engine errors only on its question lines", () => {
  for (const template of templateFiles()) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "template-probe-"));
    try {
      fs.mkdirSync(path.join(root, "aidd_docs/memory"), { recursive: true });
      fs.copyFileSync(path.join(TEMPLATES, template.capability, template.name), path.join(root, "aidd_docs/memory", template.name));
      const lines = textOf(template).split(/\r?\n/u);
      const errors = lintFile(root, `aidd_docs/memory/${template.name}`).filter((problem) => problem.severity === "error");
      assert.ok(errors.length > 0, `${template.name} asks no question`);
      for (const error of errors) {
        assert.equal(error.rule, "M3", `${template.name}:${error.line} ${error.message}`);
        assert.ok(lines[error.line - 1].includes("{{"), `${template.name}:${error.line} is not a question line`);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("a template holds no angle placeholder, guidance comment or other marker", () => {
  for (const template of templateFiles()) {
    assert.doesNotMatch(textOf(template), new RegExp(`${PLACEHOLDER.source}|\\bTODO\\b|\\bTBD\\b`, "u"), template.name);
  }
});

test("every file of capabilities.md has a template in the folder of its capability", () => {
  for (const [capability, files] of capabilityRows()) {
    for (const file of files.match(/[\w-]+\.md/gu)) {
      assert.ok(
        fs.existsSync(path.join(TEMPLATES, capability.replace(/`/gu, ""), file)),
        `${file} has no template under ${capability}`
      );
    }
  }
});

const BANK = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/memory-question-bank.json"), "utf8"));
const REPO = path.resolve(__dirname, "../..");

/** Every `{{…}}` of every template, as the file, its nearest `##` heading, its text and its line. */
function templateQuestions() {
  return templateFiles().flatMap((template) => {
    let heading = null;
    return textOf(template)
      .split(/\r?\n/u)
      .flatMap((line, index) => {
        if (line.startsWith("## ")) heading = line.slice(3).trim();
        return [...line.matchAll(/\{\{([^{}\n]*)\}\}/gu)].map(([, text]) => ({ ...template, heading, text, line: index + 1 }));
      });
  });
}

const keyOf = ({ capability, name, file, heading, text, question }) => JSON.stringify([capability, name ?? file, heading, text ?? question]);
const slotRows = () => BANK.filter((row) => row.status === "slot");

test("the question bank holds each id once", () => {
  const ids = BANK.map((row) => row.id);
  assert.deepEqual(ids.filter((id, index) => ids.indexOf(id) !== index), []);
});

test("every template question is a slot row of the question bank, once", () => {
  const rows = slotRows().map(keyOf);
  assert.deepEqual(rows.filter((key, index) => rows.indexOf(key) !== index), [], "a question is banked twice");
  const unbanked = templateQuestions()
    .filter((question) => !rows.includes(keyOf(question)))
    .map((question) => `unbanked question in ${question.capability}/${question.name}:${question.line}: ${question.text}`);
  assert.deepEqual(unbanked, []);
});

test("every slot row of the question bank is still asked by its template", () => {
  const asked = templateQuestions().map(keyOf);
  const lost = slotRows()
    .filter((row) => !asked.includes(keyOf(row)))
    .map((row) => `${row.id} slot not in ${row.capability}/${row.file} under ${row.heading ?? "no heading"}: flip it to dropped with a reason, or to merged:<id>`);
  assert.deepEqual(lost, []);
});

test("a merged row points to a slot row and a dropped row states its reason", () => {
  const slots = new Set(slotRows().map((row) => row.id));
  for (const row of BANK) {
    if (row.status === "slot") continue;
    if (row.status === "dropped") assert.ok(typeof row.reason === "string" && row.reason.trim() !== "", `${row.id} is dropped with no reason`);
    else {
      assert.match(row.status, /^merged:\S+$/u, `${row.id} has the unknown status ${row.status}`);
      assert.ok(slots.has(row.status.slice("merged:".length)), `${row.id} is merged into ${row.status.slice("merged:".length)}, which is no slot row`);
    }
  }
});

test("every accepted name of the table has a row in the question bank, under its capability", () => {
  const accepted = capabilityRows().flatMap(([capability, , , , , names]) =>
    (names.match(/[\w-]+\.md/gu) ?? []).map((file) => [capability.replace(/`/gu, ""), file])
  );
  assert.deepEqual(accepted.map(([, file]) => file).sort(), ["design.md", "forms.md", "infra.md", "integration.md", "navigation.md"]);
  for (const [capability, file] of accepted) {
    assert.ok(
      BANK.some((row) => row.capability === capability && path.basename(row.from) === file),
      `${file} is accepted by ${capability} and no row of the question bank comes from it`
    );
  }
});

test("a consumer of a template line still cites it, and the template still holds it", () => {
  const anchored = BANK.filter((row) => row.consumer !== undefined);
  assert.ok(anchored.length >= 2, "the question bank names no consumer");
  for (const row of anchored) {
    assert.ok(textOf({ capability: row.capability, name: row.file }).includes(row.anchor), `${row.id}: ${row.file} lost \`${row.anchor}\`, which ${row.consumer.path} reads`);
    assert.ok(fs.readFileSync(path.join(REPO, row.consumer.path), "utf8").includes(row.consumer.cites), `${row.id}: ${row.consumer.path} no longer cites \`${row.consumer.cites}\``);
  }
});

test("the ui template opens on the aidd_docs/ui/ pointer and keeps its macro questions", () => {
  const text = textOf({ capability: "ui", name: "ui.md" });
  const first = text.split(/\r?\n/u).find((line) => line.includes("{{"));
  assert.match(first, /^\{\{Does `aidd_docs\/ui\/` exist\? .*design system.*copy none of it\.\}\}$/u);
  assert.doesNotMatch(text, /drop everything below/u);
  for (const heading of ["Rules", "Routing", "Accessibility", "See a change"]) assert.match(text, new RegExp(`^## ${heading}$`, "mu"));
});

test("a question with no answer is dropped, and a file with no answer is not written for a conditional row only", () => {
  const text = fs.readFileSync(path.join(SKILL, "references/capabilities.md"), "utf8");
  const lines = text.split(/\r?\n/u);
  assert.ok(lines.some((line) => /question the writer answers; with no answer it is dropped\./u.test(line)), "capabilities.md does not drop a question with no answer");
  assert.ok(lines.some((line) => /A conditional row with no answer at all writes no file;/u.test(line)), "a conditional row with no answer still writes its file");
  assert.ok(lines.some((line) => /an always row is written whatever\./u.test(line)), "an always row is not written whatever");
});

test("the vcs template asks for the platform, the repository and the CLI, and the standard followed", () => {
  const text = textOf({ capability: "core", name: "vcs.md" });
  assert.match(text, /Platform: \{\{[^}]*repository[^}]*CLI/u);
  assert.match(text, /\{\{Which commit standard does the project follow, and where does it deviate\?\}\}/u);
});

test("the brief holds the functional sections, each a question answered from the repository", () => {
  const text = textOf({ capability: "core", name: "project-brief.md" });
  const headings = [...text.matchAll(/^## (.+)$/gmu)].map(([, heading]) => heading);
  assert.deepEqual(headings, ["Purpose", "Users", "Main journey", "Domain language", "Key features", "Business rules", "Out of scope"]);
  for (const heading of ["Users", "Main journey", "Business rules"]) {
    const body = text.slice(text.indexOf(`## ${heading}`)).split(/\n## /u)[0];
    assert.equal([...body.matchAll(/\{\{[^{}\n]*\}\}/gu)].length, 1, `${heading} asks one question`);
  }
});

test("the Current state only reader rule drops a secret or credential value", () => {
  const rules = fs.readFileSync(path.join(SKILL, "references/memory-rules.md"), "utf8");
  const row = rules.split(/\r?\n/u).find((line) => line.startsWith("| Current state only"));
  assert.ok(row, "memory-rules.md has no Current state only row");
  assert.match(row, /a secret or credential value/u);
});
