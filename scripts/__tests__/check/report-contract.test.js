const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { findings } = require("./helpers.js");

const ROOT = path.resolve(__dirname, "../../..");
const CONTRACT = path.join(ROOT, "scripts/check/contracts/report.json");
const SKILLS = path.join(ROOT, "plugins/aidd-dev/skills");
const TEMPLATES = { run: "02-implement/assets/run-template.md", assert: "03-assert/assets/assert-template.md", review: "05-review/assets/review-template.md" };

/** The reports a task folder collects: each template of the aidd-dev skills holds the shape the contract asks. */
let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "report-contract-"));
  fs.mkdirSync(path.join(dir, "actions"));
  fs.mkdirSync(path.join(dir, "assets"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

/** Ids found on a copy of one real template, after an edit. */
function ids(kind, edit = (text) => text, action = "[assert template](../assets/assert-template.md)\n") {
  const file = path.join(dir, "assets", path.basename(TEMPLATES[kind]));
  fs.writeFileSync(file, edit(fs.readFileSync(path.join(SKILLS, TEMPLATES[kind]), "utf8")));
  fs.writeFileSync(path.join(dir, "actions/01.md"), action);
  return findings(CONTRACT, file).map((f) => f.id);
}

describe("report contract", () => {
  it("accepts the real templates", () => {
    for (const kind of Object.keys(TEMPLATES)) assert.deepEqual(ids(kind), [], kind);
  });

  it("flags a title that does not name the report's kind", () => {
    assert.deepEqual(ids("run", (t) => t.replace("# Run:", "# Runs:")), ["REPORT-01"]);
    assert.deepEqual(ids("assert", (t) => t.replace("# Assert:", "# Report:")), ["REPORT-02"]);
    assert.deepEqual(ids("review", (t) => t.replace("# Review: ", "# Review ")), ["REPORT-03"]);
  });

  it("flags a report with no numbered section per pass", () => {
    for (const kind of Object.keys(TEMPLATES)) assert.deepEqual(ids(kind, (t) => t.replace(/^## (Run|Round) /mu, "## Pass ")), ["REPORT-04"], kind);
  });

  it("flags a run or assert pass that names no commit as a field", () => {
    for (const kind of ["run", "assert"]) assert.deepEqual(ids(kind, (t) => t.replace(/^- Head: .*$/mu, "- Head: abc")), ["REPORT-05"], kind);
  });

  it("flags an assert round with a field besides the head and the verdict, or with no verdict", () => {
    assert.deepEqual(ids("assert", (t) => t.replace("- Uncommitted changes:", "- Extra:")), ["REPORT-06"]);
    assert.deepEqual(ids("assert", (t) => t.replace(/^- Verdict: .*\n/mu, "")), ["REPORT-07"]);
  });

  it("flags an assert template no action links", () => {
    assert.deepEqual(ids("assert", (t) => t, "Fill a round.\n"), ["REPORT-08"]);
  });
});
