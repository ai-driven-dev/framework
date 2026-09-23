const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const yaml = require("js-yaml");

const root = path.resolve(__dirname, "../..");

const rawFile = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const workflow = (relativePath) => yaml.load(rawFile(relativePath));
const ruleset = () => JSON.parse(rawFile(".github/rulesets/main.json"));

const pullRequestRule = () => ruleset().rules.find((rule) => rule.type === "pull_request");

// The two workflow steps that merge a pull request into `main`, named explicitly rather than
// grepped for: `dependabot-auto-merge.yml` also runs `gh pr merge --squash`, but its PRs target
// `next` (`.github/dependabot.yml`'s `target-branch`), a branch this ruleset never restricts.
const mergesIntoMain = () => [
  {
    label: "ci.yml release-please job, Auto-merge the Release PR",
    run: workflow(".github/workflows/ci.yml").jobs["release-please"].steps.find(
      (step) => step.name === "Auto-merge the Release PR",
    ).run,
  },
  {
    label: "promote.yml, Open the promote PR, enable merge auto-merge",
    run: workflow(".github/workflows/promote.yml").jobs.promote.steps.find(
      (step) => step.name === "Open the promote PR, enable merge auto-merge",
    ).run,
  },
];

test("T1: main.json's pull_request rule allows only the merge method", () => {
  const rule = pullRequestRule();

  assert.ok(rule, "no pull_request rule in .github/rulesets/main.json");
  assert.deepEqual(rule.parameters.allowed_merge_methods, ["merge"]);
});

test("T2: ci.yml merges the release PR into main with --merge", () => {
  const step = mergesIntoMain().find((s) => s.label.startsWith("ci.yml"));

  assert.match(step.run, /gh pr merge .*--merge\b/);
});

test("T3: no step that merges a pull request into main uses --squash or --rebase", () => {
  for (const step of mergesIntoMain()) {
    assert.doesNotMatch(step.run, /--squash\b/, `${step.label} must not squash into main`);
    assert.doesNotMatch(step.run, /--rebase\b/, `${step.label} must not rebase into main`);
  }
});

test(".github/rulesets/main.json stays valid JSON", () => {
  assert.doesNotThrow(() => ruleset());
});
