const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const PLUGIN = path.resolve(__dirname, "../../plugins/aidd-context");
const { RULES, LIMITS } = require(path.join(PLUGIN, "hooks/lib/memory-rules.cjs"));
const REFERENCES = path.join(PLUGIN, "skills/02-project-memory/references");

const NO_LIMIT = "none";
const ROW = /^\|\s*(M\d+)\s*\|\s*(error|warning)\s*\|\s*([^|]*?)\s*\|/u;

function tableRows() {
  const text = fs.readFileSync(path.join(REFERENCES, "memory-rules.md"), "utf8");
  return text
    .split(/\r?\n/u)
    .map((line) => line.match(ROW))
    .filter(Boolean)
    .map(([, id, severity, limit]) => ({ id, severity, limit }));
}

test("the table lists every engine rule, with its severity and its limit", () => {
  const rows = tableRows();
  for (const { id, severity } of RULES) {
    const row = rows.find((candidate) => candidate.id === id);
    assert.ok(row, `${id} is in the engine and missing from memory-rules.md`);
    assert.equal(row.severity, severity, `${id} severity`);
    const expected = LIMITS[id] === undefined ? NO_LIMIT : `${LIMITS[id]} words`;
    assert.equal(row.limit, expected, `${id} limit`);
  }
});

test("the table lists no rule the engine does not have", () => {
  const known = new Set(RULES.map(({ id }) => id));
  for (const { id } of tableRows()) assert.ok(known.has(id), `${id} is in memory-rules.md and missing from the engine`);
});

test("the review protocol states no limit and points to the table", () => {
  const text = fs.readFileSync(path.join(REFERENCES, "review-protocol.md"), "utf8");
  assert.match(text, /memory-rules\.md/u);
  assert.doesNotMatch(text, /\b\d+\s+words\b/u);
});
