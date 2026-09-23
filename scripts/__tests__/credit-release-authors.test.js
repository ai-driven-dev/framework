const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const yaml = require("js-yaml");

const { credit, tagsFromOutputs, who, creditReleases } = require("../credit-release-authors.cjs");

const root = path.resolve(__dirname, "../..");

// Real lines from https://github.com/ai-driven-dev/framework/releases/tag/v5.10.0, read-only,
// so the transform is pinned against notes release-please actually produced.
const LINE_A =
  "* **cli:** a record names the skill its own prompt invoked ([#783](https://github.com/ai-driven-dev/framework/issues/783)) ([7fbe889](https://github.com/ai-driven-dev/framework/commit/7fbe8897cee6ed522d1f52a2124c4109eb101543))";
const LINE_B =
  "* **cli:** a repair that repaired nothing says so ([#762](https://github.com/ai-driven-dev/framework/issues/762)) ([dccbef2](https://github.com/ai-driven-dev/framework/commit/dccbef25b43943904ec9a3cee3b5c2056d2cfdd6))";
const LINE_CLOSES =
  "* **cli:** carry the catalog's recommended field under metadata, where Claude Code does not warn ([#803](https://github.com/ai-driven-dev/framework/issues/803)) ([4531b74](https://github.com/ai-driven-dev/framework/commit/4531b7466a03cd136764540e55f5c867dbdcafb5)), closes [#800](https://github.com/ai-driven-dev/framework/issues/800)";
const LINE_DEPENDABOT =
  "* **deps-dev:** bump js-yaml from 5.3.0 to 5.4.1 ([#734](https://github.com/ai-driven-dev/framework/issues/734)) ([07a2364](https://github.com/ai-driven-dev/framework/commit/07a2364e282bc0aee1750250ee5b7594a6a5fe3a))";
const LINE_NO_SHA = "### Bug Fixes";
const HEADER = "## [5.10.0](https://github.com/ai-driven-dev/framework/compare/v5.9.0...v5.10.0) (2026-09-09)";

test("T1: two contributors, each credited", () => {
  const body = [LINE_A, LINE_B].join("\n");
  const resolve = (sha) => ({ "7fbe8897cee6ed522d1f52a2124c4109eb101543": "@blafourcade", dccbef25b43943904ec9a3cee3b5c2056d2cfdd6: "@alexsoyes" })[sha];

  const credited = credit(body, resolve);

  assert.equal(credited, [`${LINE_A} (@blafourcade)`, `${LINE_B} (@alexsoyes)`].join("\n"));
});

test("T2: a repeated contributor, credited on each line", () => {
  const body = [LINE_A, LINE_B].join("\n");
  const resolve = () => "@blafourcade";

  const credited = credit(body, resolve);

  assert.equal(credited, [`${LINE_A} (@blafourcade)`, `${LINE_B} (@blafourcade)`].join("\n"));
});

test("T3: a bot, credited as @dependabot[bot]", () => {
  const resolve = () => "@dependabot[bot]";

  const credited = credit(LINE_DEPENDABOT, resolve);

  assert.equal(credited, `${LINE_DEPENDABOT} (@dependabot[bot])`);
});

test("T4: a line ending in closes #N, credited after it", () => {
  const resolve = () => "@blafourcade";

  const credited = credit(LINE_CLOSES, resolve);

  assert.equal(credited, `${LINE_CLOSES} (@blafourcade)`);
});

test("T5: a line without a commit SHA, untouched", () => {
  const body = [HEADER, LINE_NO_SHA].join("\n");
  const resolve = () => {
    throw new Error("resolve must not be called for a line with no commit SHA");
  };

  const credited = credit(body, resolve);

  assert.equal(credited, body);
});

test("T6: a line already credited, untouched, and re-running never duplicates", () => {
  const resolve = () => "@blafourcade";
  const once = credit(LINE_A, resolve);

  const twice = credit(once, resolve);

  assert.equal(twice, once);
  assert.equal(twice, `${LINE_A} (@blafourcade)`);
});

test("T6 (bot, brackets in the credit): re-running a dependabot-credited line never duplicates", () => {
  const resolve = () => "@dependabot[bot]";
  const once = credit(LINE_DEPENDABOT, resolve);

  const twice = credit(once, resolve);

  assert.equal(twice, once);
});

test("T8: a no-login name containing parentheses is not re-credited on a second pass", () => {
  const resolve = () => "Jane (JD) Doe";
  const once = credit(LINE_A, resolve);

  const twice = credit(once, resolve);

  assert.equal(twice, once);
  assert.equal(twice, `${LINE_A} (Jane (JD) Doe)`);
});

test("T8 (closes tail): a no-login name containing parentheses is not re-credited after a closes-tail line", () => {
  const resolve = () => "Jane (JD) Doe";
  const once = credit(LINE_CLOSES, resolve);

  const twice = credit(once, resolve);

  assert.equal(twice, once);
  assert.equal(twice, `${LINE_CLOSES} (Jane (JD) Doe)`);
});

test("T7: no login resolves, the name is appended without @", () => {
  const resolve = () => "Alex Soyer";

  const credited = credit(LINE_A, resolve);

  assert.equal(credited, `${LINE_A} (Alex Soyer)`);
});

test("mutation guard: credit() is idempotent on a full multi-section body mixing every shape above", () => {
  const SHA_TO_WHO = {
    "7fbe8897cee6ed522d1f52a2124c4109eb101543": "@blafourcade",
    dccbef25b43943904ec9a3cee3b5c2056d2cfdd6: "Alex Soyer",
    "07a2364e282bc0aee1750250ee5b7594a6a5fe3a": "@dependabot[bot]",
    "4531b7466a03cd136764540e55f5c867dbdcafb5": "@blafourcade",
  };
  const resolve = (sha) => SHA_TO_WHO[sha];
  const body = [HEADER, LINE_A, LINE_B, LINE_DEPENDABOT, LINE_CLOSES].join("\n");

  const once = credit(body, resolve);
  const twice = credit(once, resolve);

  assert.equal(twice, once);
});

test("tagsFromOutputs: root path reads bare tag_name, other paths read <path>--tag_name", () => {
  const outputs = {
    paths_released: JSON.stringify([".", "cli", "plugins/aidd-dev"]),
    tag_name: "v5.10.0",
    "cli--tag_name": "cli-v5.3.0",
    "plugins/aidd-dev--tag_name": "aidd-dev-v2.5.0",
  };

  assert.deepEqual(tagsFromOutputs(outputs), ["v5.10.0", "cli-v5.3.0", "aidd-dev-v2.5.0"]);
});

test("tagsFromOutputs: no paths released is an empty list", () => {
  assert.deepEqual(tagsFromOutputs({ paths_released: "" }), []);
  assert.deepEqual(tagsFromOutputs({ paths_released: "[]" }), []);
});

// --- creditReleases(): reads, credits and writes back only what changed --

test("creditReleases: an already-credited tag's body is read but never written", () => {
  const outputs = { paths_released: JSON.stringify(["."]), tag_name: "v1.0.0" };
  const bodies = { "v1.0.0": `${LINE_A} (@blafourcade)` };
  const writes = [];
  const read = (tag) => bodies[tag];
  const write = (tag, body) => writes.push({ tag, body });
  const resolve = () => "@blafourcade";

  creditReleases("owner/repo", outputs, { read, resolve, write });

  assert.deepEqual(writes, []);
});

test("creditReleases: a tag whose body changes is written exactly once, with the credited body", () => {
  const outputs = { paths_released: JSON.stringify([".", "cli"]), tag_name: "v1.0.0", "cli--tag_name": "cli-v1.0.0" };
  const bodies = {
    "v1.0.0": LINE_A,
    "cli-v1.0.0": `${LINE_A} (@blafourcade)`, // already credited: must not be written again
  };
  const writes = [];
  const read = (tag) => bodies[tag];
  const write = (tag, body) => writes.push({ tag, body });
  const resolve = () => "@blafourcade";

  creditReleases("owner/repo", outputs, { read, resolve, write });

  assert.deepEqual(writes, [{ tag: "v1.0.0", body: `${LINE_A} (@blafourcade)` }]);
});

// --- who() on the gh api reply's actual shape ----------------------------
// Regression: `gh api ... -q '[...] | @tsv'` piped through `.trim()` silently drops a
// login-less commit's leading tab, so `split("\t")` under-counted the fields and the name
// got credited as `@Full Name`. `who()` parses jq's own JSON object output instead, which
// has no such leading-empty-field trap.

test("who: a commit with a login is credited as @login", () => {
  assert.equal(who('{"login":"blafourcade","name":"Baptiste Lafourcade"}'), "@blafourcade");
});

test("who: a bot login is credited as @dependabot[bot]", () => {
  assert.equal(who('{"login":"dependabot[bot]","name":"dependabot[bot]"}'), "@dependabot[bot]");
});

test("who: no login resolves to the plain commit-author name, not @Name", () => {
  assert.equal(who('{"login":"","name":"Alex Soyer"}'), "Alex Soyer");
});

// --- CLI entry: a bad or missing RELEASE_OUTPUTS fails loud, not silent --
// Regression: with no guard, a missing or key-less RELEASE_OUTPUTS parses to `{}`,
// `tagsFromOutputs` reads no paths, the tag loop runs zero times, and the process exits 0
// having credited nothing and said nothing was wrong. Each case below spawns the real CLI
// entry on a fake repo; since the guard fires before `main()` ever runs, no case reaches
// `gh`.
const SCRIPT = path.join(root, "scripts/credit-release-authors.cjs");

function runScript(env) {
  return spawnSync(process.execPath, [SCRIPT, "example/none"], { env, encoding: "utf8" });
}

test("CLI: RELEASE_OUTPUTS missing from the environment exits non-zero with a clear message", () => {
  const env = { ...process.env };
  delete env.RELEASE_OUTPUTS;

  const result = runScript(env);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /RELEASE_OUTPUTS/);
  assert.match(result.stderr, /missing/i);
});

test("CLI: RELEASE_OUTPUTS holding unparseable JSON exits non-zero with a clear message", () => {
  const env = { ...process.env, RELEASE_OUTPUTS: "{not json" };

  const result = runScript(env);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /RELEASE_OUTPUTS/);
  assert.match(result.stderr, /valid JSON/i);
});

test("CLI: RELEASE_OUTPUTS with no paths_released key exits non-zero with a clear message", () => {
  const env = { ...process.env, RELEASE_OUTPUTS: JSON.stringify({ release_created: "false" }) };

  const result = runScript(env);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /paths_released/);
});

// --- ci.yml wiring -------------------------------------------------------

const workflow = () => yaml.load(fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8"));

const creditStep = () => {
  const steps = workflow().jobs["release-please"].steps;
  return steps.find((step) => step.run && /credit-release-authors\.cjs/.test(step.run));
};

test("W1: the credit step runs only when releases were created", () => {
  const step = creditStep();

  assert.ok(step, "no step in the release-please job runs credit-release-authors.cjs");
  assert.equal(step.if, "${{ steps.release.outputs.releases_created == 'true' }}");
});

test("W2: the credit step runs after the release step, with the App token", () => {
  const steps = workflow().jobs["release-please"].steps;
  const releaseIndex = steps.findIndex((step) => step.id === "release");
  const creditIndex = steps.findIndex((step) => step.run && /credit-release-authors\.cjs/.test(step.run));

  assert.ok(releaseIndex >= 0 && creditIndex >= 0);
  assert.ok(creditIndex > releaseIndex, "the credit step must run after the release step");
  assert.equal(creditStep().env.GH_TOKEN, "${{ steps.app-token.outputs.token }}");
});

test("W4: the credit step's RELEASE_OUTPUTS carries steps.release.outputs verbatim", () => {
  assert.equal(creditStep().env.RELEASE_OUTPUTS, "${{ toJSON(steps.release.outputs) }}");
});

test("W5: a checkout step runs immediately before the credit step, so the script exists on disk", () => {
  const steps = workflow().jobs["release-please"].steps;
  const creditIndex = steps.findIndex((step) => step.run && /credit-release-authors\.cjs/.test(step.run));
  const precedingStep = steps[creditIndex - 1];

  assert.ok(precedingStep, "no step precedes the credit step");
  assert.match(precedingStep.uses || "", /actions\/checkout@/, "the step immediately before the credit step must be a checkout");
});

test("W3: a crediting failure never blocks the release's build and publish jobs", () => {
  assert.equal(creditStep()["continue-on-error"], true);
});

test("W6: the checkout step added for crediting never blocks build and publish either", () => {
  const steps = workflow().jobs["release-please"].steps;
  const creditIndex = steps.findIndex((step) => step.run && /credit-release-authors\.cjs/.test(step.run));
  const checkoutStep = steps[creditIndex - 1];

  assert.ok(checkoutStep, "no step precedes the credit step");
  assert.equal(checkoutStep["continue-on-error"], true, "a checkout failure must not fail the release-please job either");
});
