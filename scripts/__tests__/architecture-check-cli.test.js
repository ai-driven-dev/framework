const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const { governedPaths, scan } = require("../lib/architecture-scan.js");

const REPO_ROOT = path.resolve(__dirname, "../..");
const CHECK = path.join(REPO_ROOT, "scripts/check-architecture-rules.js");

/**
 * The commit-time half of issue #250. The write-time hook only ever sees Claude Code; this
 * check is what every other tool, and every person, runs into. Its tests are therefore the
 * ones that matter for coverage, not the hook's.
 */

const CLEAN_SKILL = [
  "# Clean skill",
  "",
  "## Actions",
  "",
  "| # | Action | Role |",
  "| --- | --- | --- |",
  "| 01 | `step` | Do the one thing |",
  "",
].join("\n");

const SIBLING_ADDRESS_SKILL = CLEAN_SKILL.replace(
  "# Clean skill",
  "# Clean skill\n\nSee @aidd-fixture-b:02-thing for the other half."
);

const UNCITED_ACTION_SKILL = CLEAN_SKILL.replace("| 01 | `step` | Do the one thing |", "");

/** A temp tree with a `plugins/` root, so the file classifier applies exactly as it does here. */
function makeTree(skillContent, actionNames = ["01-step.md"]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "architecture-check-"));
  const skillDir = path.join(root, "plugins/aidd-fixture-a/skills/01-demo");
  fs.mkdirSync(path.join(skillDir, "actions"), { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), skillContent);
  for (const name of actionNames) {
    fs.writeFileSync(path.join(skillDir, "actions", name), "# action\n");
  }
  return { root, skill: "plugins/aidd-fixture-a/skills/01-demo/SKILL.md" };
}

test("a skill citing every action it provides yields nothing", () => {
  const { root, skill } = makeTree(CLEAN_SKILL);
  assert.deepEqual(scan(root, [skill]), []);
});

test("a skill addressing a sibling plugin is caught, and names the sibling", () => {
  const { root, skill } = makeTree(SIBLING_ADDRESS_SKILL);
  const found = scan(root, [skill]);
  assert.equal(found.length, 1);
  assert.equal(found[0].rule, "orthogonality");
  assert.equal(found[0].plugin, "aidd-fixture-b");
});

test("an action file the router never cites is caught, and names the file", () => {
  const { root, skill } = makeTree(UNCITED_ACTION_SKILL);
  const found = scan(root, [skill]);
  assert.equal(found.length, 1);
  assert.equal(found[0].rule, "router-coherence");
  assert.match(found[0].message, /01-step\.md/);
});

test("a path outside the governed surface contributes nothing", () => {
  const { root } = makeTree(SIBLING_ADDRESS_SKILL);
  fs.writeFileSync(path.join(root, "README.md"), "See @aidd-fixture-b:02-thing.\n");
  assert.deepEqual(scan(root, ["README.md"]), []);
});

test("a path that does not exist is skipped rather than thrown over", () => {
  const { root } = makeTree(CLEAN_SKILL);
  assert.deepEqual(scan(root, ["plugins/aidd-fixture-a/skills/99-gone/SKILL.md"]), []);
});

test("the whole governed tree of this repository is silent, and is not empty", () => {
  // A scan that matched nothing would pass every assertion above. Pin both halves.
  const paths = governedPaths(REPO_ROOT);
  assert.ok(paths.length > 100, `expected the tree to govern more than 100 files, got ${paths.length}`);
  assert.deepEqual(scan(REPO_ROOT, paths), []);
});

test("the command exits 0 on this repository and says how much it checked", () => {
  const result = spawnSync(process.execPath, [CHECK], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /governed file\(s\) checked, no violation/);
});

test("the command exits 1 and prints the fix when a governed file breaks a rule", () => {
  const { root, skill } = makeTree(SIBLING_ADDRESS_SKILL);
  const result = spawnSync(process.execPath, [CHECK, "--root", root, skill], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /addresses sibling plugin "aidd-fixture-b"/);
  assert.match(result.stderr, /Fix: name the concept aidd-fixture-b owns/);
});

test("the command scans a whole tree it is pointed at, not only this repository", () => {
  const { root } = makeTree(UNCITED_ACTION_SKILL);
  const result = spawnSync(process.execPath, [CHECK, "--root", root], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /never names action file "01-step\.md"/);
});
