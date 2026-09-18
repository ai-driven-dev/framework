const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { checkArchitecture } = require("../lib/architecture-rules.js");

const ROOT = path.resolve(__dirname, "../..");
const FIXTURES = path.join(__dirname, "fixtures/architecture-rules");

function fixture(relPath) {
  return fs.readFileSync(path.join(FIXTURES, relPath), "utf8");
}

/**
 * Thin tree walker for the sweep test only. The engine itself never reads the filesystem —
 * this is the caller that supplies its inputs from the real `plugins/` tree.
 */
function sweepPlugins() {
  const files = [];
  const pluginsDir = path.join(ROOT, "plugins");

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "assets") continue;
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(full);
      }
    }
  }
  walk(pluginsDir);

  const violations = [];
  for (const absPath of files) {
    const relPath = path.relative(ROOT, absPath).split(path.sep).join("/");
    const content = fs.readFileSync(absPath, "utf8");
    let actionFileNames;
    if (path.basename(absPath) === "SKILL.md") {
      const actionsDir = path.join(path.dirname(absPath), "actions");
      actionFileNames = fs.existsSync(actionsDir)
        ? fs.readdirSync(actionsDir).filter((f) => f.endsWith(".md"))
        : [];
    }
    violations.push(...checkArchitecture(relPath, content, actionFileNames));
  }
  return violations;
}

test("a clean skill with no sibling address and a fully-named action yields no violations", () => {
  const content = fixture("clean-skill/SKILL.md");
  const violations = checkArchitecture(
    "plugins/aidd-fixture-a/skills/01-clean/SKILL.md",
    content,
    ["01-step.md"]
  );
  assert.deepEqual(violations, []);
});

test("a skill addressing a sibling plugin yields a violation naming file, line and owning plugin", () => {
  const content = fixture("cross-address-skill/SKILL.md");
  const filePath = "plugins/aidd-fixture-a/skills/02-cross-address/SKILL.md";
  const violations = checkArchitecture(filePath, content, ["01-step.md"]);

  assert.equal(violations.length, 1);
  const [violation] = violations;
  assert.equal(violation.file, filePath);
  assert.equal(violation.plugin, "aidd-fixture-b");
  const lines = content.split("\n");
  assert.equal(lines[violation.line - 1].includes("/aidd-fixture-b:01-noop"), true);
});

test("an agent's Skills you may invoke list addressing siblings yields no violations", () => {
  const content = fixture("agent-permission-list.md");
  const violations = checkArchitecture(
    "plugins/aidd-fixture-a/agents/reviewer.md",
    content
  );
  assert.deepEqual(violations, []);
});

test("an orchestrator plugin is exempt wholesale from both rules", () => {
  const content = fixture("orchestrator-skill/SKILL.md");
  const violations = checkArchitecture(
    "plugins/aidd-orchestrator/skills/99-fixture/SKILL.md",
    content,
    ["01-route.md"] // never named in the section; would violate rule 2 if not exempt
  );
  assert.deepEqual(violations, []);
});

test("a file under assets/ yields no violations regardless of content", () => {
  const content = fixture("assets-note.md");
  const violations = checkArchitecture(
    "plugins/aidd-fixture-a/skills/01-clean/assets/note.md",
    content
  );
  assert.deepEqual(violations, []);
});

test("an action file the Actions section never names yields one violation", () => {
  const content = fixture("unnamed-action-skill/SKILL.md");
  const filePath = "plugins/aidd-fixture-a/skills/03-unnamed-action/SKILL.md";
  const violations = checkArchitecture(filePath, content, [
    "01-step-one.md",
    "02-step-two.md",
  ]);

  assert.equal(violations.length, 1);
  const [violation] = violations;
  assert.equal(violation.file, filePath);
  assert.equal(violation.plugin, "aidd-fixture-a");
  const lines = content.split("\n");
  assert.equal(lines[violation.line - 1].trim(), "## Actions");
});

test("a name the Actions section cites with no action file behind it yields one violation", () => {
  const content = fixture("phantom-citation-skill/SKILL.md");
  const filePath = "plugins/aidd-fixture-a/skills/04-phantom-citation/SKILL.md";
  const violations = checkArchitecture(filePath, content, ["01-step.md"]);

  assert.equal(violations.length, 1);
  const [violation] = violations;
  assert.equal(violation.file, filePath);
  assert.equal(violation.plugin, "aidd-fixture-a");
  const lines = content.split("\n");
  assert.equal(lines[violation.line - 1].includes("ghost-step"), true);
});

test("a skill whose Actions section and action files agree yields no violations", () => {
  const content = fixture("clean-skill/SKILL.md");
  const violations = checkArchitecture(
    "plugins/aidd-fixture-a/skills/01-clean/SKILL.md",
    content,
    ["01-step.md"]
  );
  assert.deepEqual(violations, []);
});

test("sweeping the repository's own plugins/ tree yields zero violations", () => {
  const violations = sweepPlugins();
  assert.deepEqual(violations, []);
});
