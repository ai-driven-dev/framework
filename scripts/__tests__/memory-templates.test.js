const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const PLUGIN = path.resolve(__dirname, "../../plugins/aidd-context");
const SKILL = path.join(PLUGIN, "skills/02-project-memory");
const TEMPLATES = path.join(SKILL, "assets/templates/memory");
const { PLACEHOLDER } = require("./fixtures/unfinished-marker.js");
const { lintFile } = require(path.join(PLUGIN, "hooks/memory.cjs"));

const ALWAYS = ["project-brief.md", "architecture.md", "coding-assertions.md", "testing.md", "vcs.md", "ecosystem.md"];
const CONDITIONAL = ["backlog.md", "deployment.md", "contract.md", "auth.md", "data.md", "async.md", "ui.md", "native.md"];
const FORMER = {
  "codebase-map.md": "core",
  "integration.md": "contract",
  "infra.md": "deployment",
  "api.md": "contract",
  "cli.md": "contract",
  "package.md": "contract",
  "database.md": "data",
  "messaging.md": "async",
  "realtime.md": "async",
  "design.md": "ui",
  "forms.md": "ui",
  "navigation.md": "ui",
  "mobile.md": "native",
  "desktop.md": "native",
};

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

test("the templates are the fourteen files, six always written and eight conditional", () => {
  assert.deepEqual(templateFiles().map(({ name }) => name).sort(), [...ALWAYS, ...CONDITIONAL].sort());
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
  for (const [capability, , files] of capabilityRows()) {
    for (const file of files.match(/[\w-]+\.md/gu)) {
      assert.ok(
        fs.existsSync(path.join(TEMPLATES, capability.replace(/`/gu, ""), file)),
        `${file} has no template under ${capability}`
      );
    }
  }
});

test("every former file is named by the capability that replaced it", () => {
  const rows = capabilityRows();
  for (const [former, capability] of Object.entries(FORMER)) {
    const row = rows.find(([name]) => name.replace(/`/gu, "") === capability);
    assert.ok(row[4].includes(former), `${former} is not in the Former files of ${capability}`);
  }
});

test("the ui template keeps one pointer line and drops the rest when a design system file exists", () => {
  const text = textOf({ capability: "ui", name: "ui.md" });
  assert.match(
    text,
    /^\{\{Does aidd_docs\/ui\/system\.md exist\? Then keep one line: .*`aidd_docs\/ui\/`.*, and drop everything below\.\}\}$/mu
  );
});

test("a question with no answer is dropped, and a file with no answer is not written for a conditional row only", () => {
  const text = fs.readFileSync(path.join(SKILL, "references/capabilities.md"), "utf8");
  const rule = text.split(/\r?\n/u).find((line) => line.includes("no answer"));
  assert.ok(rule, "capabilities.md states no rule about a missing answer");
  assert.match(rule, /question with no answer is dropped/u);
  assert.match(rule, /conditional row with no answer at all writes no file/u);
  assert.match(rule, /always row is written whatever/u);
});

test("the vcs template asks for the platform, the repository and the CLI, and the standard followed", () => {
  const text = textOf({ capability: "core", name: "vcs.md" });
  assert.match(text, /Platform: \{\{[^}]*repository[^}]*CLI/u);
  assert.match(text, /\{\{Which commit standard does the project follow, and where does it deviate\?\}\}/u);
});
