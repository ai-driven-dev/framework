const assert = require("node:assert/strict");
const path = require("node:path");
const { describe, it } = require("node:test");
const { engine, LIB, ENGINE } = require("../fixtures/aidd-ui/project.js");

// The engine documents its commands once: `help` is the only text a skill points at.
const { COMMANDS } = require(ENGINE);
const { HELP } = require(path.join(LIB, "help.cjs"));

const COUNT_LINE = "aidd-ui: <n> errors, <m> warnings";
const ERROR_LINE = '<file>[:<line>] <rule> ["<excerpt>"] => <fix>';
const WARNING_LINE = "<file>[:<line>] <rule> warning <message> => <fix>";
const GROUPED_LINE = '<rule> ×<count> in <file>|<folder>/* ["<excerpt>"] => <fix>';
const MAX_WORDS = 12;
const lines = (text) => text.split("\n");

describe("aidd-ui engine help", () => {
  it("holds one entry for each command, help included, and none more", () => {
    assert.ok(Object.hasOwn(COMMANDS, "help"));
    assert.deepEqual(Object.keys(HELP).sort(), Object.keys(COMMANDS).sort());
  });

  it("prints a command's usage, effects, output and exit codes, and exits 0", () => {
    for (const [name, entry] of Object.entries(HELP)) {
      const run = engine("help", name);
      assert.deepEqual([name, run.status, run.stderr], [name, 0, ""]);
      for (const part of [...entry.usage, ...entry.effects, ...entry.output, ...entry.exits]) assert.ok(lines(run.stdout).some((line) => line.includes(part)), `${name}: ${part}`);
    }
  });

  it("lists the commands when no command is named", () => {
    const run = engine("help");
    assert.equal(run.status, 0);
    for (const name of Object.keys(COMMANDS)) assert.ok(run.stdout.includes(name), name);
  });

  it("shows validate's count line, error line and warning line, no grouped line", () => {
    const { status, stdout } = engine("help", "validate");
    assert.equal(status, 0);
    for (const shape of [COUNT_LINE, ERROR_LINE, WARNING_LINE]) assert.ok(stdout.includes(shape), shape);
    assert.equal(stdout.includes(GROUPED_LINE), false);
  });

  it("shows the grouped line of the hook alone", () => {
    for (const name of Object.keys(HELP)) assert.equal(engine("help", name).stdout.includes(GROUPED_LINE), name === "hook", name);
  });

  it("says what --task names and that bump never writes it", () => {
    assert.ok(engine("help", "bump").stdout.includes("`--task` names a folder under `aidd_docs/tasks/`, never written."));
  });

  it("keeps the facts the engine's behaviour owes the skills: refusals, an uncreated task folder, ungrouped validation", () => {
    const text = (name) => engine("help", name).stdout;
    assert.ok(text("bump").includes("`--created` refuses `brand`, and an id that already has rows."));
    assert.ok(text("bump").includes("`--task` need not exist: `history.md` rows only cite it."));
    assert.ok(text("extract").includes("Refuses when it cannot: no `system.md`, no `code-tokens`, or an unreadable file."));
    assert.ok(text("validate").includes("It prints every problem, ungrouped."));
  });

  it("exits 2 on an unknown command, listing the commands on stderr alone", () => {
    const run = engine("help", "valdate");
    assert.equal(run.status, 2);
    assert.equal(run.stdout, "");
    for (const name of Object.keys(COMMANDS)) assert.ok(run.stderr.includes(name), name);
  });

  it("keeps every sentence to twelve words at most, a usage line apart", () => {
    const offenders = [];
    for (const [name, entry] of Object.entries(HELP)) {
      for (const text of [...entry.effects, ...entry.output, ...entry.exits, entry.summary]) {
        for (const sentence of text.split(/(?<=[.!?])\s+/)) {
          const words = sentence.split(/\s+/).filter(Boolean).length;
          if (words > MAX_WORDS) offenders.push(`${name} ${words} words: ${sentence.slice(0, 60)}`);
        }
      }
    }
    assert.deepEqual(offenders, []);
  });
});
