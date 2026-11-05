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

// A rule stated outside the table: a limit in digits ("25 words") or in words ("under twenty-five
// words"), or the unfinished markers M3 owns.
const STATED_LIMIT = /\b(?:\d+|(?:under|over|max|maximum|than)\s+[a-z]+(?:-[a-z]+)?)\s+words\b|\b(?:TODO|TBD)\b/iu;
// Left to the phase that rewrites the file.
const EXEMPT = new Set(["references/reading-sources.md", "assets/templates/memory/README.md"]);

function skillFiles() {
  const skill = path.join(PLUGIN, "skills/02-project-memory");
  const list = (dir) => fs.readdirSync(path.join(skill, dir)).map((name) => `${dir}/${name}`);
  return ["SKILL.md", ...list("actions"), ...list("references")].filter((file) => file !== "references/memory-rules.md");
}

test("the guard sees a limit in digits, in words, and a restated marker rule", () => {
  for (const line of ["under 25 words", "keep it under twenty-five words", "at most 400 words", "no TODO remains"]) {
    assert.match(line, STATED_LIMIT, line);
  }
});

test("no limit is stated outside the table, and the review protocol points to it", () => {
  const protocol = fs.readFileSync(path.join(REFERENCES, "review-protocol.md"), "utf8");
  assert.match(protocol, /memory-rules\.md/u);
  for (const file of skillFiles().filter((name) => !EXEMPT.has(name))) {
    const text = fs.readFileSync(path.join(PLUGIN, "skills/02-project-memory", file), "utf8");
    const line = text.split(/\r?\n/u).find((candidate) => STATED_LIMIT.test(candidate));
    assert.equal(line, undefined, `${file} states a limit: ${line}`);
  }
});
