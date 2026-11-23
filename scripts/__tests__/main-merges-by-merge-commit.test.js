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

// The steps that merge a pull request into `main`.
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

test("every merge into main uses --merge and an empty --body, never --squash or --rebase", () => {
  for (const step of mergesIntoMain()) {
    const merge = step.run.replace(/\\\r?\n\s*/gu, " ").split(/\r?\n/u).find((line) => line.trim().startsWith("gh pr merge"));

    assert.ok(merge, `${step.label} has no gh pr merge command`);
    assert.match(merge, /--merge\b/, `${step.label} must merge with --merge`);
    assert.doesNotMatch(merge, /--squash\b|--rebase\b/, `${step.label} must not squash or rebase into main`);
    assert.match(merge, /--body\s+""/u, `${step.label} must pass --body ""`);
  }
});
