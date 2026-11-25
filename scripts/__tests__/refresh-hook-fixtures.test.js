const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { parseArgs, toolMatcher, HOSTS } = require("../refresh-hook-fixtures.cjs");

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
