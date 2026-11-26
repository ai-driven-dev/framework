const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { parseArgs, toolMatcher, HOSTS, readHostOutput, judgeRun, combine } = require("../refresh-hook-fixtures.cjs");

describe("parseArgs", () => {
  it("runs every host with a capture when none is named", () => {
    assert.deepEqual(parseArgs([]).hosts, Object.keys(HOSTS));
  });

  it("names a flag that is missing its value", () => {
    assert.throws(() => parseArgs(["--host"]), /missing value for --host/);
    assert.throws(() => parseArgs(["--model"]), /missing value for --model/);
  });

  it("refuses a model that does not say which host it is for", () => {
    assert.throws(() => parseArgs(["--model", "haiku"]), /host=id/);
  });

  it("refuses a host with no capture, naming it", () => {
    assert.throws(() => parseArgs(["--host", "claude,nope"]), /no capture for: nope/);
  });

  it("reads the model of a host", () => {
    assert.deepEqual(parseArgs(["--host", "claude", "--model", "claude=sonnet", "--write"]), {
      hosts: ["claude"],
      models: { claude: "sonnet" },
      write: true,
    });
  });
});

describe("toolMatcher", () => {
  const fixture = (event, ...names) => ({ event, samples: names.map((name) => ({ payload: { name } })) });

  it("names each tool the tool-event fixtures were captured from, once", () => {
    const fixtures = [fixture("PostToolUse", "write_file", "run_command"), fixture("PreToolUse", "write_file", "edit_file")];
    assert.equal(toolMatcher(fixtures, (payload) => payload.name), "write_file|run_command|edit_file");
  });

  it("ignores a moment that is not a tool event", () => {
    assert.equal(toolMatcher([fixture("Stop", "x"), fixture("postToolUse", "Write")], (payload) => payload.name), "Write");
  });
});

describe("readHostOutput", () => {
  it("keeps the last line that says something, past the colour codes a host closes with", () => {
    assert.equal(readHostOutput("working\nFree usage limit reached\n\u001b[0m\n").last, "Free usage limit reached");
  });

  it("quotes the line where the host refuses on a usage limit, wherever in its output", () => {
    assert.equal(readHostOutput("\u001b[91mFree usage limit reached\u001b[0m\nmore\n").refusal, "Free usage limit reached");
    assert.equal(readHostOutput("all done\n").refusal, null);
  });
});

describe("judgeRun", () => {
  const fixtures = [
    { event: "start", samples: [{ payload: { a: "x" } }] },
    { event: "end", samples: [{ payload: { b: "x" } }] },
  ];
  const run = (lines, output = "ok\n") => judgeRun({}, fixtures, { lines, output });

  it("cannot judge a host that refused, even when some moments fired", () => {
    const verdict = run([{ event: "start", payload: { a: "y" } }], "Free usage limit reached\n");
    assert.match(verdict.unjudged, /usage limit/i);
  });

  it("cannot judge a host that delivered no hook at all", () => {
    assert.match(run([]).unjudged, /no hook/);
  });

  it("judges each moment when the host delivered some", () => {
    const verdict = run([{ event: "start", payload: { a: "y" } }]);
    assert.equal(verdict.unjudged, null);
    assert.deepEqual(verdict.moments.map(({ event, status }) => [event, status]), [["start", "match"], ["end", "not-fired"]]);
  });

  it("does not count a moment the host never delivers headless", () => {
    const verdict = judgeRun({ neverFires: ["end"] }, fixtures, { lines: [{ event: "start", payload: { a: 1 } }], output: "" });
    assert.equal(verdict.moments[1].expected, true);
  });
});

describe("combine", () => {
  it("keeps a drift when another host could not be run", () => {
    assert.equal(combine(1, 2), 1);
    assert.equal(combine(2, 1), 1);
  });

  it("keeps the worse of the rest", () => {
    assert.equal(combine(0, 2), 2);
    assert.equal(combine(2, 0), 2);
    assert.equal(combine(0, 0), 0);
  });
});
