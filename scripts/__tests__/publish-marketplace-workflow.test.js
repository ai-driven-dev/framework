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
