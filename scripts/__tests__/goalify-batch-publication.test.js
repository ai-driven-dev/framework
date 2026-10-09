const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const yaml = require("js-yaml");

const ROOT = path.resolve(__dirname, "../..");
const DEV = "plugins/aidd-dev";
const BATCH = `${DEV}/skills/10-batch`;
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

function obsoleteAddresses(text) {
  return [...text.matchAll(/\b10-todo\b/gu)].map((match) => match[0]);
}

test("the published batch capability resolves to its own router and action", () => {
  const manifest = JSON.parse(read(`${DEV}/.claude-plugin/plugin.json`));
  assert.ok(manifest.skills.includes("./skills/10-batch"), "the batch capability is not exported");
  assert.ok(!manifest.skills.includes("./skills/10-todo"), "the obsolete invocation is still exported");

  const frontmatter = yaml.load(read(`${BATCH}/SKILL.md`).split(/^---\s*$/mu)[1]);
  assert.equal(frontmatter.name, "10-batch");
  assert.ok(frontmatter.description);
  assert.ok(frontmatter["argument-hint"]);
  assert.ok(fs.existsSync(path.join(ROOT, BATCH, "actions/01-batch.md")));
  assert.ok(!fs.existsSync(path.join(ROOT, DEV, "skills/10-todo/SKILL.md")), "no old skill alias ships");
});

test("active documentation and orchestration addresses resolve to batch", () => {
  const files = [
    `${DEV}/README.md`,
    `${DEV}/CATALOG.md`,
    "docs/CATALOG.md",
    "docs/ARCHITECTURE.md",
    "aidd_docs/README.md",
    "plugins/aidd-orchestrator/skills/01-sdlc/references/03-check.md",
  ];
  const stale = files.flatMap((file) => obsoleteAddresses(read(file)).map((address) => `${file}: ${address}`));
  assert.deepEqual(stale, [], "a public caller still points to a capability that no longer ships");
});

test("the address guard detects a stale dispatch without rejecting ordinary todo terminology", () => {
  assert.deepEqual(obsoleteAddresses("Dispatch /aidd-dev:10-todo."), ["10-todo"]);
  assert.deepEqual(obsoleteAddresses("A board's Todo column and a tracked todo list."), []);
});
