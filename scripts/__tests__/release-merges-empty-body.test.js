const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const yaml = require("js-yaml");

/** Every merge this repository's own automation makes into `main` passes `--body ""`. */

const root = path.resolve(__dirname, "../..");

function loadWorkflow(relativePath) {
  return yaml.load(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

/** Joins `\`-continued shell lines into one command per entry. */
function logicalCommands(run) {
  return run
    .replace(/\\\r?\n\s*/gu, " ")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

// --- ci.yml: the Release PR auto-merge ------------------------------------

test("ci.yml: the Release PR auto-merge command carries --body \"\"", () => {
  const workflow = loadWorkflow(".github/workflows/ci.yml");
  const steps = workflow.jobs["release-please"].steps;
  const step = steps.find((s) => s.name === "Auto-merge the Release PR");

  assert.ok(step, "no 'Auto-merge the Release PR' step found in ci.yml's release-please job");
  const mergeCommand = logicalCommands(step.run).find((line) => line.startsWith("gh pr merge"));
  assert.ok(mergeCommand, "no gh pr merge command found in the Auto-merge the Release PR step");
  assert.match(mergeCommand, /--body\s+""/u, `expected --body "" in: ${mergeCommand}`);
});

// --- promote.yml: the next -> main promotion merge ------------------------

test("promote.yml: the promote PR merge command carries --body \"\", isolated from gh pr create's own --body", () => {
  const workflow = loadWorkflow(".github/workflows/promote.yml");
  const step = workflow.jobs.promote.steps.find((s) => s.name === "Open the promote PR, enable merge auto-merge");

  assert.ok(step, "no 'Open the promote PR, enable merge auto-merge' step found in promote.yml");
  const commands = logicalCommands(step.run);

  const createCommand = commands.find((line) => line.startsWith("PR=$(gh pr create") || line.includes("gh pr create"));
  assert.ok(createCommand, "no gh pr create command found");
  assert.match(createCommand, /--body\s+"Automated/u, "gh pr create is expected to keep its own descriptive --body");

  const mergeCommand = commands.find((line) => line.startsWith("gh pr merge"));
  assert.ok(mergeCommand, "no gh pr merge command found in the promote step");
  assert.match(mergeCommand, /--body\s+""/u, `expected --body "" in: ${mergeCommand}`);
});

test("promote.yml: the commitHeadline recorded-subject check is still present, untouched by the --body change", () => {
  const workflow = loadWorkflow(".github/workflows/promote.yml");
  const step = workflow.jobs.promote.steps.find((s) => s.name === "Open the promote PR, enable merge auto-merge");

  assert.match(step.run, /autoMergeRequest\.commitHeadline/u);
  assert.match(step.run, /Auto-merge did not record the commit subject/u);
});
