const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { judge } = require("../check-claude-tokens-end-to-end.cjs");

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

  it("calls itself broken when the API billed fewer calls than prompts were sent", () => {
    assert.equal(judge({ ...reports(), billed: BILLED.slice(0, 1) }).code, 2);
  });
});
