const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const check = () => read("plugins/aidd-orchestrator/skills/01-sdlc/references/03-check.md");
const prose = () => check().split("```mermaid")[0];

test("check runs acceptance QA on the same contract and candidate once review clears", () => {
  assert.match(prose(), /review clears[^\n]*`\/aidd-qa:01-acceptance-qa`[^\n]*same contract and committed candidate/i);
});

test("check routes every QA verdict", () => {
  const text = prose();
  assert.match(text, /`pass` or `skipped`[^\n]*Challenge/);
  assert.match(text, /`fail`[^\n]*Deliver/);
  assert.match(text, /ambiguous or incomplete criteria[^\n]*Frame/);
  assert.match(text, /environment, permissions, dependencies or tooling[^\n]*stop[^\n]*exact blocker and the user action/);
});

test("check shows only passing scenarios through the demo", () => {
  assert.match(prose(), /`pass`[^\n]*`\/aidd-qa:02-demo`[^\n]*passing scenarios/);
});

test("check commits its own reports, and a product or validator change re-enters Review", () => {
  assert.match(prose(), /After QA and Challenge clear, a product or validator change re-enters Review/);
  assert.match(prose(), /Commit everything this zone wrote, never a failed or blocked QA run/);
});

test("check passes qa.md and the artifact paths to the pull request", () => {
  assert.match(prose(), /pull request[^\n]*`qa\.md` and the artifact paths/);
});

test("check diagram draws QA and the demo", () => {
  const diagram = check().split("```mermaid")[1];
  assert.match(diagram, /\/aidd-qa:01-acceptance-qa/);
  assert.match(diagram, /\/aidd-qa:02-demo/);
});

test("the checker may invoke both QA skills and writes only its skills' reports", () => {
  const checker = read("plugins/aidd-dev/agents/checker.md");
  assert.match(checker, /- `\/aidd-qa:01-acceptance-qa`\n- `\/aidd-qa:02-demo`/);
  assert.match(checker, /Write only the reports your skills own, never product, contract, plan or validator/);
});

test("the pull request links evidence files the caller passes", () => {
  assert.match(read("plugins/aidd-vcs/skills/02-pull-request/actions/02-draft.md"), /Link every evidence file the caller passes under the template's testing or verification section/);
});

test("the pull request never presents a failed or blocked run as cleared", () => {
  assert.match(read("plugins/aidd-vcs/skills/02-pull-request/actions/02-draft.md"), /Never present a failed or blocked run as cleared/);
});

test("the pull request skill stays blind to aidd-qa", () => {
  const dir = path.join(root, "plugins/aidd-vcs/skills/02-pull-request");
  const files = fs.readdirSync(dir, { recursive: true }).filter((f) => f.endsWith(".md"));
  assert.deepEqual(files.filter((f) => /aidd-qa/.test(fs.readFileSync(path.join(dir, f), "utf8"))), []);
});

test("aidd-qa is on the recommended path", () => {
  const plugins = JSON.parse(read(".claude-plugin/marketplace.json")).plugins;
  assert.equal(plugins.find((p) => p.name === "aidd-qa").metadata.recommended, true);
});

test("docs no longer put aidd-qa off the curated path", () => {
  for (const file of ["README.md", "aidd_docs/memory/architecture.md", "docs/CATALOG.md"]) {
    assert.doesNotMatch(read(file), /aidd-qa[^\n]*(off the curated|install those separately)/, file);
  }
});

test("README installs aidd-qa and counts seven recommended plugins", () => {
  const readme = read("README.md");
  assert.match(readme, /\/plugin install aidd-qa@aidd-framework/);
  assert.match(readme, /Installs the 7 recommended plugins/);
});

test("the developer journey never claims the acceptance gate", () => {
  assert.match(read("plugins/aidd-dev/skills/06-test/SKILL.md"), /Do NOT use for independent acceptance QA/);
});
