const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { engine, makeTmp, removeTmp, writeProject, put, validate, UI, LIB, ENGINE } = require("../fixtures/aidd-ui/project.js");

// The engine documents its commands once: `help` is the only text a skill points at.
const { COMMANDS } = require(ENGINE);
const cli = require(path.join(LIB, "cli.cjs"));
const { HELP, COUNT_LINE, ERROR_LINE, WARNING_LINE, GROUPED_LINE } = require(path.join(LIB, "help.cjs"));

const MAX_WORDS = 12;
const TASK = "aidd_docs/tasks/help";
/** A set of variants `id` holding one folder per row, `[name, intent, tone]`. */
const draft = (dir, id, rows) => {
  const table = ["| Variant | Intent | Tone |", "| --- | --- | --- |", ...rows.map(([name, intent, tone]) => `| ${name} | ${intent} | ${tone} |`)];
  put(dir, `${UI}/drafts/${id}/variants.md`, `${table.join("\n")}\n`);
  for (const [name, , tone] of rows) put(dir, `${UI}/drafts/${id}/${name}/brand.md`, `${tone}\n`);
};
const PAIR = [["a", "calm", "calm"], ["b", "bold", "bold"]];
/** The regular expression a printed line must match to have the shape `help` shows. */
const matching = (shape) =>
  new RegExp(
    `^${shape
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/<file>/g, "\\S+")
      .replace(/\\\[:<line>\\\]/g, "(?::\\d+)?")
      .replace(/<rule>/g, "[A-Z]\\d+")
      .replace(/ \\\["<excerpt>"\\\]/g, '(?: ".*")?')
      .replace(/<(message|fix)>/g, ".+")
      .replace(/<n>|<m>/g, "\\d+")
      .replace(/\\\(s\\\)/g, "s?")}$`
  );

describe("aidd-ui engine help", () => {
  let tmp;

  beforeEach(() => {
    tmp = makeTmp("aidd-ui-help-");
    writeProject(tmp);
  });

  afterEach(() => removeTmp(tmp));

  it("holds one entry for each command, help included, and none more", () => {
    assert.ok(Object.hasOwn(COMMANDS, "help"));
    assert.deepEqual(Object.keys(HELP).sort(), Object.keys(COMMANDS).sort());
  });

  it("declares the exit codes each command returns, and no other", () => {
    const withoutTokens = () => fs.rmSync(path.join(tmp, UI, "tokens.json"));
    const empty = makeTmp("aidd-ui-help-empty-");
    // for each command, the arguments that give each code
    const runs = {
      validate: { 0: ["validate", tmp], 1: () => (withoutTokens(), ["validate", tmp]), 2: ["validate", empty] },
      tokens: { 0: ["tokens", tmp], 1: () => (withoutTokens(), ["tokens", tmp]), 2: ["tokens", empty] },
      hook: { 0: ["hook"] },
      impact: { 0: ["impact", "color.action.default", "--root", tmp], 2: ["impact", "no.such.token", "--root", tmp] },
      extract: { 0: ["extract", "--force", "--root", tmp], 2: ["extract", "--root", tmp] },
      bump: { 0: ["bump", "--task", TASK, "--change", "c", "color.action.default", "--root", tmp], 2: ["bump", "--root", tmp] },
      publish: { 0: () => (engine("bump", "--task", TASK, "--change", "c", "color.action.default", "--root", tmp), ["publish", "--root", tmp]), 2: ["publish", "--root", tmp] },
      compare: {
        0: () => (draft(tmp, "ok", PAIR), ["compare", "ok", "--root", tmp]),
        1: () => (draft(tmp, "one", PAIR.slice(0, 1)), ["compare", "one", "--root", tmp]),
        2: ["compare", "none", "--root", tmp],
      },
      keep: { 0: () => (draft(tmp, "ok", PAIR), ["keep", "ok", "a", "--root", tmp]), 2: ["keep", "none", "a", "--root", tmp] },
      help: { 0: ["help", "validate"], 2: ["help", "nothing"] },
    };
    assert.deepEqual(Object.keys(runs).sort(), Object.keys(HELP).sort());
    for (const [name, byCode] of Object.entries(runs)) {
      const declared = HELP[name].exits.map((line) => Number(line.split(" ")[0])).sort();
      const seen = {};
      for (const [code, args] of Object.entries(byCode)) {
        seen[code] = engine(...(typeof args === "function" ? args() : args)).status;
        writeProject(tmp);
      }
      assert.deepEqual(seen, Object.fromEntries(Object.keys(byCode).map((code) => [code, Number(code)])), name);
      assert.deepEqual(Object.keys(byCode).map(Number).sort(), declared, name);
    }
    removeTmp(empty);
  });

  it("shows the count line, the error line and the warning line as validate prints them", () => {
    put(tmp, "src/ui/x.css", ".a { margin-left: 4px; color: #ff0000; }\n");
    const { out } = validate(tmp);
    assert.match(out[0], matching(COUNT_LINE));
    const [errors, warnings] = [out.filter((line) => !line.includes(" warning ")), out.filter((line) => line.includes(" warning "))];
    assert.equal(warnings.length, 1);
    for (const line of errors.slice(1)) assert.match(line, matching(ERROR_LINE));
    for (const line of warnings) assert.match(line, matching(WARNING_LINE));
    for (const line of errors.slice(1)) assert.doesNotMatch(line, matching(WARNING_LINE));
    assert.equal(errors.slice(1).length, 2);
    const text = engine("help", "validate").stdout;
    for (const shape of [COUNT_LINE, ERROR_LINE, WARNING_LINE]) assert.ok(text.includes(shape), shape);
  });

  it("names, as about the code, the errors validate reports on a file outside the design system", () => {
    put(tmp, "src/ui/x.css", ".a { margin-left: 4px; color: #ff0000; }\n");
    const named = engine("help", "validate").stdout.match(/((?:C\d+(?:, | and )?)+) are about the code/)[1].match(/C\d+/g);
    assert.deepEqual(named, ["C4", "C6", "C10"]);
    const outside = validate(tmp).out.filter((line) => !line.startsWith(UI) && !line.includes(" warning ") && / C\d+ /.test(line)).map((line) => line.match(/ (C\d+) /)[1]);
    assert.deepEqual(outside, ["C4", "C6"]); // C10 is pinned on a drifting token file in extract.test.js
  });

  it("says what bump leaves as it prints it: a record with the reason it was not raised", () => {
    const text = engine("help", "bump").stdout;
    const left = [0, 1].flatMap(() => JSON.parse(engine("bump", "--task", TASK, "--change", "c", "color.action.default", "--root", tmp).stdout).left);
    assert.deepEqual([...new Set(left.map((each) => each.why))].sort(), ["already raised for this task", "deprecated"]);
    for (const each of left) assert.deepEqual(Object.keys(each), ["id", "why"]);
    assert.ok(left.some((each) => each.id === "home"), "a screen is left too");
    assert.equal(HELP.bump.output.find((line) => line.includes("`left`")).includes("element"), false);
    assert.ok(text.includes("`left`"));
    assert.ok(text.includes("`why`"));
    for (const why of new Set(left.map((each) => each.why))) assert.ok(text.includes(why.split(" for ")[0]), why);
  });

  it("names every file extract writes beside tokens.json, and lists a refusal under effects", () => {
    const { written } = JSON.parse(engine("extract", "--force", "--root", tmp).stdout);
    const effects = HELP.extract.effects.join(" ");
    for (const file of written.filter((each) => path.dirname(each) === UI)) assert.ok(effects.includes(path.basename(file)), file);
    for (const [name, entry] of Object.entries(HELP)) assert.deepEqual(entry.output.filter((line) => /^Refuses/.test(line)), [], name);
  });

  it("names the verdict of a compare entry, and no rating", () => {
    const { output, effects } = HELP.compare;
    assert.ok(output.includes('An entry is {"name", "verdict", "comment"}.'));
    assert.ok(output.includes('A verdict is "keep", "revise", "discard", or null if undecided.'));
    assert.ok(effects.includes("The page remembers the review across reloads, until the set changes."));
    assert.doesNotMatch(engine("help", "compare").stdout, /rating|discarded/);
  });

  it("shows the grouped line of the hook alone", () => {
    for (const name of Object.keys(HELP)) assert.equal(engine("help", name).stdout.includes(GROUPED_LINE), name === "hook", name);
  });

  it("shows in its usage lines the flags the engine parses, and no other", () => {
    const parsed = Object.entries(cli).filter(([name]) => name.endsWith("_FLAG")).map(([, flag]) => flag).sort();
    const shown = [...new Set(Object.values(HELP).flatMap((entry) => entry.usage).flatMap((usage) => usage.match(/--[a-z]+/g) ?? []))].sort();
    assert.deepEqual(shown, parsed);
    const usages = Object.entries(cli).filter(([name]) => name.endsWith("_USAGE")).map(([, usage]) => usage);
    assert.deepEqual(Object.values(HELP).flatMap((entry) => entry.usage).sort(), usages.sort());
  });

  it("lists the commands when no command is named", () => {
    const run = engine("help");
    assert.equal(run.status, 0);
    for (const name of Object.keys(COMMANDS)) assert.ok(run.stdout.includes(name), name);
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
