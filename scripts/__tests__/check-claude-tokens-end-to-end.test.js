const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { judge, judgeAttended } = require("../check-claude-tokens-end-to-end.cjs");

const BILLED = [
  { input_tokens: 100, output_tokens: 7, cache_read_input_tokens: 11, cache_creation_input_tokens: 13 },
  { input_tokens: 200, output_tokens: 14, cache_read_input_tokens: 22, cache_creation_input_tokens: 26 },
];

const counter = (tokens) => ({ tokens, unknown_records: 0 });

/** A report row or totals that hold exactly what BILLED billed. */
function exact(overrides = {}) {
  return { records: 2, input: counter(300), output: counter(21), cache_read: counter(33), cache_write: counter(39), ...overrides };
}

function reports(row = exact(), totals = exact()) {
  return {
    billed: BILLED,
    byTask: { totals, rows: [{ kind: "value", key: "demo", ...row }] },
    byTicket: { totals, rows: [{ kind: "value", key: "T-1", ...row }] },
    here: { filters: { task: "demo", repository: "a".repeat(64) }, totals: row },
  };
}

describe("the report of a real claude run, judged against what the API billed", () => {
  it("passes when the totals, the task and the ticket each hold every billed token", () => {
    assert.equal(judge(reports()).code, 0);
  });

  it("fails when one counter differs from what was billed", () => {
    const verdict = judge(reports(exact({ cache_read: counter(34) })));
    assert.equal(verdict.code, 1);
    assert.match(verdict.message, /task demo cache_read 34, billed 33/u);
  });

  it("fails when a call is missing", () => {
    assert.equal(judge(reports(exact(), exact({ records: 1 }))).code, 1);
  });

  it("fails when a counter is unknown, even if its known tokens add up", () => {
    assert.equal(judge(reports(exact({ input: { tokens: 300, unknown_records: 1 } }))).code, 1);
  });

  it("fails when the work is not on the declared task", () => {
    const unattributed = reports();
    unattributed.byTask.rows = [{ kind: "unattributed", key: null, ...exact() }];
    assert.equal(judge(unattributed).code, 1);
  });

  it("fails when the report narrowed to the task in this repository misses a call", () => {
    const narrowed = reports();
    narrowed.here.totals = exact({ records: 1 });
    assert.match(judge(narrowed).message, /task demo here records 1, billed 2/u);
  });

  it("passes when `.` names a repository with no hosted origin by its root commit", () => {
    const narrowed = reports();
    narrowed.here.filters.repository = "b".repeat(40);
    assert.equal(judge(narrowed).code, 0);
  });

  it("fails when `.` is not resolved to the repository's id", () => {
    const narrowed = reports();
    narrowed.here.filters.repository = ".";
    assert.match(judge(narrowed).message, /--repository \. resolved to "\."/u);
  });

  it("calls itself broken when the API billed fewer calls than prompts were sent", () => {
    assert.equal(judge({ ...reports(), billed: BILLED.slice(0, 1) }).code, 2);
  });
});

const DECLARED = "00000000-0000-4000-8000-00000000000a";
const CLEARED = "00000000-0000-4000-8000-00000000000b";

/** What a person's session left when it held: nothing billed before the declaration, the
 * declaration answered by the hook, and the declared session carried across `/clear`. */
function attended(overrides = {}) {
  return {
    billedBeforeDeclaring: 0,
    sessions: [{ session_id: DECLARED, task: "demo", ticket: "T-1", none: false, by: "hook-intercept" }],
    carries: [{ session_id: CLEARED, from: DECLARED }],
    ...overrides,
  };
}

describe("a person's session, judged from what it left", () => {
  it("passes when asked first, answered by the hook and carried across /clear", () => {
    assert.equal(judgeAttended(attended()).code, 0);
  });

  it("fails when a prompt reached the API before the task was declared", () => {
    assert.match(judgeAttended(attended({ billedBeforeDeclaring: 1 })).message, /before the task was declared/u);
  });

  it("fails when the declaration was made by the command, not answered by the hook", () => {
    const byCommand = attended({ sessions: [{ ...attended().sessions[0], by: "command" }] });
    assert.equal(judgeAttended(byCommand).code, 1);
  });

  it("fails when /clear carried another session than the declared one", () => {
    assert.equal(judgeAttended(attended({ carries: [{ session_id: CLEARED, from: CLEARED }] })).code, 1);
  });

  it("fails when nothing was carried", () => {
    assert.match(judgeAttended(attended({ carries: [] })).message, /0 carries/u);
  });
});
