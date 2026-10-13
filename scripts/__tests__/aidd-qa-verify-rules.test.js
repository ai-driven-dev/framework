const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const verify = path.resolve(__dirname, "../../plugins/aidd-qa/skills/01-acceptance-qa");
const read = (file) => fs.readFileSync(path.join(verify, file), "utf8");

const rules = [
  ["one happy path per journey", "actions/01-load-scope.md", /One happy path per journey/],
  ["a criterion is observable through a browser or a command", "actions/01-load-scope.md", /Keep criteria observable through a browser or a command, never an API alone/],
  ["a command scenario compares stdout and exit code", "references/interface-browser-playwright-cli.md", /Compare stdout and exit code/],
  ["invoked by another skill or agent, never ask", "SKILL.md", /another skill or agent, never ask: return `blocked` with the question/],
  ["test-only proof precedes the entry and any snapshot", "actions/03-prepare-run.md", /\*\*Prove\.\*\* A documented reset that deletes data: start nothing until its storage is proven test-only.*never by an environment name or your own inference[\s\S]*\*\*Preflight\.\*\* Start the entry/],
  ["a crashed or UI-less entry gets one fallback, else blocked", "actions/03-prepare-run.md", /one fallback entry the same memory or browser test names \(a file found in the tree is not one\), else `blocked`.*never invent a start command/],
  ["viewport and permissions resolve criterion, memory, default", "actions/03-prepare-run.md", /from the criterion, then `Browser QA` memory, then `1280×720`/],
  ["a vague outcome becomes one observable condition", "actions/01-load-scope.md", /Define for a vague outcome .* one condition the page shows/],
  ["a timed boundary is probed on both sides", "references/interface-browser-playwright-cli.md", /Probe a timed boundary on both sides/],
  ["a short transition is measured inside run-code", "references/interface-browser-playwright-cli.md", /shorter than any sampling inside the single `run-code`/],
  ["destructive is defined by the fixture boundary", "actions/01-load-scope.md", /verified teardown of scenario-owned test data is not/],
  ["prepare-run reads the runner reference first", "actions/03-prepare-run.md", /1\. \*\*Reuse\.\*\* Read \[the runner reference\]/],
  ["load-scope shows the scope only when a decision is needed", "actions/01-load-scope.md", /\*\*Show\.\*\* Only when a decision is needed/],
  ["page is the only run-code binding", "references/interface-browser-playwright-cli.md", /`page` as its only binding.*inside `page\.evaluate`/],
  ["a limitation that weakens the proof yields blocked", "actions/04-run-scenarios.md", /limitation that weakens the proof => `blocked`/],
  ["the report holds Limitations", "assets/qa-report-template.md", /## Limitations/],
];

for (const [name, file, pattern] of rules) {
  test(name, () => assert.match(read(file), pattern));
}
