const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test } = require("node:test");
const yaml = require("js-yaml");

const workflow = (name) => yaml.load(readFileSync(resolve(__dirname, "../../.github/workflows", name), "utf8"));

/** The index of the single step whose script contains `needle`. */
function stepIndex(steps, needle) {
  const found = steps.map((step, index) => (String(step.run ?? "").includes(needle) ? index : -1)).filter((index) => index >= 0);
  assert.equal(found.length, 1, `exactly one step runs ${needle}`);
  return found[0];
}

test("the release job tags, then verifies the tag, then advances the stable branch", () => {
  const { steps } = workflow("ci.yml").jobs["publish-marketplace"];
  const tagged = stepIndex(steps, "publish-marketplace.cjs tag");
  const verified = stepIndex(steps, "verify-marketplace.cjs");
  const advanced = stepIndex(steps, "publish-marketplace.cjs advance");
  assert.ok(tagged < verified && verified < advanced);
});

test("the dry run follows the same order", () => {
  const [{ run }] = workflow("marketplace-dry-run.yml").jobs.simulate.steps.slice(-1);
  const tagged = run.indexOf("publish-marketplace.cjs tag");
  const verified = run.indexOf("verify-marketplace.cjs");
  const advanced = run.indexOf("publish-marketplace.cjs advance");
  assert.ok(tagged >= 0 && tagged < verified && verified < advanced);
});

test("the release job and the dry run mint the distribution token from the one shared action", () => {
  const minted = (steps) => steps.filter((step) => step.uses === "./.github/actions/marketplace-token");
  assert.equal(minted(workflow("ci.yml").jobs["publish-marketplace"].steps).length, 1);
  assert.equal(minted(workflow("marketplace-dry-run.yml").jobs.simulate.steps).length, 1);
});

test("the dry run proves the token can write to the distribution repository, on a manual run only", () => {
  const steps = workflow("marketplace-dry-run.yml").jobs.simulate.steps;
  const probe = steps.find((step) => String(step.run ?? "").includes("push --dry-run"));
  assert.ok(probe, "a step dry-runs a push");
  assert.equal(probe.if, "github.event_name == 'workflow_dispatch'");
  assert.match(probe.run, /gh auth setup-git/);
  assert.ok(!probe.run.includes("x-access-token"), "the token is not embedded in a URL");
  assert.equal(probe.env.OWNER, "${{ steps.app-token.outputs.owner }}");
  assert.equal(probe.env.REPO, "${{ steps.app-token.outputs.repo }}");
  assert.ok(!/marketplace-distribution\.json/.test(probe.run), "the repository path is not derived again");
  const mint = steps.find((step) => step.uses === "./.github/actions/marketplace-token");
  assert.equal(mint.if, "github.event_name == 'workflow_dispatch'");
  assert.ok(steps.indexOf(mint) < steps.indexOf(probe));
  assert.ok(!/echo[^\n]*\$\{?(TOKEN|GH_TOKEN)/.test(probe.run), "the token is never echoed");
});

test("the dry run lists the published tools once, from the registry script's own output", () => {
  const steps = workflow("marketplace-dry-run.yml").jobs.simulate.steps;
  assert.equal(steps.filter((step) => String(step.run ?? "").includes("marketplace-tools.cjs")).length, 1);
  assert.ok(!steps.some((step) => String(step.run ?? "").includes("publishableTools")));
});
