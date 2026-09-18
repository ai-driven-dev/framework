const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { checkArchitecture, classifyFile } = require("../lib/architecture-rules.js");

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
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(full);
      }
    }
  }
  walk(pluginsDir);

  const violations = [];
  let skillsWithActions = 0;
  for (const absPath of files) {
    const relPath = path.relative(ROOT, absPath).split(path.sep).join("/");
    // The engine's own classifier decides what is governed — including `assets/` — so the
    // walker never keeps a second copy of that rule that could drift from it.
    if (!classifyFile(relPath)) continue;
    const content = fs.readFileSync(absPath, "utf8");
    let actionFileNames;
    if (path.basename(absPath) === "SKILL.md") {
      const actionsDir = path.join(path.dirname(absPath), "actions");
      actionFileNames = fs.existsSync(actionsDir)
        ? fs.readdirSync(actionsDir).filter((f) => f.endsWith(".md"))
        : [];
      if (actionFileNames.length > 0) skillsWithActions += 1;
    }
    violations.push(...checkArchitecture(relPath, content, actionFileNames));
  }
  return { violations, skillsWithActions };
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

test("an orchestrator plugin is exempt from orthogonality alone", () => {
  const content = fixture("orchestrator-skill/SKILL.md");
  // No actionFileNames: isolates rule one, since rule two short-circuits on an empty list.
  const violations = checkArchitecture(
    "plugins/aidd-orchestrator/skills/99-fixture/SKILL.md",
    content
  );
  assert.deepEqual(violations, []);
});

test("router coherence still applies to an orchestrator plugin", () => {
  const content = fixture("orchestrator-incoherent-skill/SKILL.md");
  const filePath = "plugins/aidd-orchestrator/skills/99-fixture/SKILL.md";
  const violations = checkArchitecture(filePath, content, ["01-route.md"]);

  assert.equal(violations.length, 1);
  const [violation] = violations;
  assert.equal(violation.rule, "router-coherence");
  assert.equal(violation.plugin, "aidd-orchestrator");
});

test("a file under assets/ yields no violations regardless of content", () => {
  const content = fixture("assets-note.md");
  const violations = checkArchitecture(
    "plugins/aidd-fixture-a/skills/01-clean/assets/note.md",
    content
  );
  assert.deepEqual(violations, []);
});

test("an action file nested a level deeper than usual is still governed", () => {
  const content = fixture("nested-action.md");
  const filePath = "plugins/aidd-fixture-a/skills/01-clean/actions/group/nested-action.md";
  const violations = checkArchitecture(filePath, content);

  assert.equal(violations.length, 1);
  const [violation] = violations;
  assert.equal(violation.plugin, "aidd-fixture-b");
});

test("a SKILL.md nested a level deeper than usual is still governed", () => {
  const content = fixture("nested-skill/SKILL.md");
  const filePath = "plugins/aidd-fixture-a/skills/01-clean/variant/SKILL.md";
  const violations = checkArchitecture(filePath, content);

  assert.equal(violations.length, 1);
  const [violation] = violations;
  assert.equal(violation.plugin, "aidd-fixture-b");
});

test("a reference file nested two levels under references/ is still governed", () => {
  const content = fixture("nested-reference.md");
  const filePath = "plugins/aidd-fixture-a/skills/01-clean/references/state/nested-reference.md";
  const violations = checkArchitecture(filePath, content);

  assert.equal(violations.length, 1);
  const [violation] = violations;
  assert.equal(violation.plugin, "aidd-fixture-b");
});

test("a SKILL.md nested under assets/ is ungoverned for that reason alone", () => {
  const content = fixture("nested-assets-skill/SKILL.md");
  const violations = checkArchitecture(
    "plugins/aidd-fixture-a/skills/01-clean/assets/nested/SKILL.md",
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

test("00-onboard's own reference menus are exempt from orthogonality", () => {
  const content = fixture("onboard-menu.md");
  const filePath = "plugins/aidd-context/skills/00-onboard/references/order/onboard-menu.md";
  const violations = checkArchitecture(filePath, content);
  assert.deepEqual(violations, []);
});

test("a bare plugin:skill address is caught, but not one embedded in a longer identifier", () => {
  const content = fixture("bare-address-skill/SKILL.md");
  const filePath = "plugins/aidd-fixture-a/skills/07-bare-address/SKILL.md";
  const violations = checkArchitecture(filePath, content, ["01-step.md"]);

  assert.equal(violations.length, 1);
  const [violation] = violations;
  assert.equal(violation.plugin, "aidd-fixture-b");
  assert.match(violation.message, /"aidd-fixture-b:01-noop"/);
});

test("a stem that is a substring of a sibling action's stem is not mistaken for a mention", () => {
  const content = fixture("stem-substring-skill/SKILL.md");
  const filePath = "plugins/aidd-fixture-a/skills/05-stem-substring/SKILL.md";
  const violations = checkArchitecture(filePath, content, [
    "01-assert.md",
    "02-assert-architecture.md",
  ]);

  assert.equal(violations.length, 1);
  const [violation] = violations;
  assert.match(violation.message, /"01-assert\.md"/);
});

test("a deleted table row is still caught when unrelated prose loosely contains its word", () => {
  // Regression for the substring-over-prose bug: "Run them in order, `01 → 04`. The plan is
  // the culmination." contains the word "plan" in ordinary prose, not as a table cell, an
  // actions/ path, or a backticked .md filename — so it must not count as naming 04-plan.md.
  const content = fixture("deleted-row-masked-by-prose-skill/SKILL.md");
  const filePath = "plugins/aidd-fixture-a/skills/09-deleted-row/SKILL.md";
  const violations = checkArchitecture(filePath, content, ["01-frame.md", "04-plan.md"]);

  assert.equal(violations.length, 1);
  const [violation] = violations;
  assert.match(violation.message, /"04-plan\.md"/);
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
  const { violations, skillsWithActions } = sweepPlugins();
  assert.deepEqual(violations, []);
  // A sweep that never actually exercised a skill with action files would pass the same way —
  // this pins the sweep to the measured count so it cannot go vacuously green.
  assert.equal(skillsWithActions, 48);
});
