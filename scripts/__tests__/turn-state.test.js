const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const LIBRARY = path.resolve(__dirname, "../../plugins/aidd-context/hooks/lib/common-rules.cjs");
const {
  turnMark,
  sweepTurns,
  readBaseline,
  leaveBaseline,
  readTurn,
  markWrite,
  leaveTurn,
  consumeTurn,
  tellOnce,
  requiredAtStop,
} = require(LIBRARY);

const PLUGIN = "some-plugin";
const SESSION = "00000000-0000-4000-8000-000000000000";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Runs `body` with the system's temp folder pointed at a fresh one, so no state leaks between tests. */
function withTmp(body) {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "turn-state-")));
  // `TMPDIR` names it on POSIX, `TEMP` and `TMP` on Windows.
  const names = ["TMPDIR", "TEMP", "TMP"];
  const before = names.map((name) => process.env[name]);
  for (const name of names) process.env[name] = tmp;
  try {
    return body(tmp);
  } finally {
    names.forEach((name, index) => {
      if (before[index] === undefined) delete process.env[name];
      else process.env[name] = before[index];
    });
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const error = (file, line, rule = "R", excerpt = "x") => ({ file, line, rule, excerpt, error: true });
const textOf = (texts) => (file) => texts[file] ?? null;

test("a mark lives in <tmpdir>/aidd-hooks-<uid>/<plugin>/<session>, its folders 0700 and its file 0600", { skip: typeof process.getuid !== "function" }, () => {
  withTmp((tmp) => {
    const mark = turnMark(PLUGIN, SESSION);
    assert.equal(mark, path.join(tmp, `aidd-hooks-${process.getuid()}`, PLUGIN, SESSION));
    const turn = readTurn(mark);
    markWrite(turn, { file: "/p/a.md", written: "one", replaced: "" });
    leaveTurn(mark, turn);
    assert.equal(fs.statSync(path.dirname(path.dirname(mark))).mode & 0o777, 0o700);
    assert.equal(fs.statSync(path.dirname(mark)).mode & 0o777, 0o700);
    assert.equal(fs.statSync(mark).mode & 0o777, 0o600);
  });
});

test("a session id outside [A-Za-z0-9_-]{1,128} has no mark, and nothing is written for it", () => {
  withTmp((tmp) => {
    for (const id of ["../x", "a/b", "", "x".repeat(129), null, undefined, 42]) assert.equal(turnMark(PLUGIN, id), null, String(id));
    assert.deepEqual(fs.readdirSync(tmp), []);
  });
});

test("a state folder open to others, or a link in its place, is no state folder", { skip: typeof process.getuid !== "function" }, () => {
  withTmp((tmp) => {
    const hooks = path.join(tmp, `aidd-hooks-${process.getuid()}`);
    fs.mkdirSync(hooks, { mode: 0o700 });
    fs.chmodSync(hooks, 0o777);
    assert.equal(turnMark(PLUGIN, SESSION), null);
    fs.rmSync(hooks, { recursive: true });
    const elsewhere = fs.mkdtempSync(path.join(tmp, "elsewhere-"));
    fs.symlinkSync(elsewhere, hooks);
    assert.equal(turnMark(PLUGIN, SESSION), null);
  });
});

test("the sweep removes state older than a day, never a fresh one, and removes a link without following it", () => {
  withTmp((tmp) => {
    const mark = turnMark(PLUGIN, SESSION);
    const folder = path.dirname(mark);
    const old = path.join(folder, "old");
    const fresh = path.join(folder, "fresh");
    const target = path.join(tmp, "target");
    fs.writeFileSync(old, "[]");
    fs.writeFileSync(fresh, "[]");
    fs.writeFileSync(target, "kept");
    fs.symlinkSync(target, path.join(folder, "link"));
    const past = new Date(Date.now() - DAY_MS - 60_000);
    fs.utimesSync(old, past, past);
    fs.lutimesSync(path.join(folder, "link"), past, past);
    fs.utimesSync(target, past, past);
    sweepTurns(PLUGIN);
    assert.deepEqual(fs.readdirSync(folder).sort(), ["fresh"]);
    assert.equal(fs.readFileSync(target, "utf8"), "kept");
  });
});

test("a baseline counts the errors by file, rule and excerpt, never by line, and leaves warnings out", () => {
  withTmp(() => {
    const mark = turnMark(PLUGIN, SESSION);
    assert.equal(readBaseline(mark), null);
    leaveBaseline(mark, [error("a", 1), error("a", 9), { ...error("a", 2, "W"), error: false }]);
    assert.deepEqual([...readBaseline(mark)], [[JSON.stringify(["a", "R", "x"]), 2]]);
    assert.equal(readBaseline(null), null);
  });
});

test("a mark is consumed once: the next turn starts clean", () => {
  withTmp(() => {
    const mark = turnMark(PLUGIN, SESSION);
    assert.equal(consumeTurn(mark), null);
    const turn = readTurn(mark);
    markWrite(turn, { file: "a", written: "one", replaced: "" });
    leaveTurn(mark, turn);
    assert.deepEqual([...consumeTurn(mark).net], [[JSON.stringify(["a", "one"]), 1]]);
    assert.equal(consumeTurn(mark), null);
  });
});

test("a mark with no proven line is still a mark: its Stop runs and requires nothing", () => {
  withTmp(() => {
    const mark = turnMark(PLUGIN, SESSION);
    leaveTurn(mark, readTurn(mark));
    const turn = consumeTurn(mark);
    assert.notEqual(turn, null);
    assert.deepEqual(requiredAtStop(turn, [error("a", 1)], null, textOf({ a: "x\n" })), []);
  });
});

test("the net counts written lines in and replaced lines out: a line changed and changed back nets to nothing", () => {
  const turn = readTurn(null);
  markWrite(turn, { file: "a", written: "slot", replaced: "clean" });
  markWrite(turn, { file: "a", written: "clean", replaced: "slot" });
  assert.deepEqual(requiredAtStop(turn, [error("a", 3)], null, textOf({ a: "# T\n\nclean\n" })), []);
});

test("a whole-file write without what it replaced proves no line, baseline or not; with it, only the lines it changed", () => {
  const texts = textOf({ a: "# T\n\nslot\n" });
  const unproven = readTurn(null);
  markWrite(unproven, { file: "a", written: "# T\n\nslot\n", whole: true });
  assert.deepEqual(requiredAtStop(unproven, [error("a", 3)], null, texts), []);
  assert.deepEqual(requiredAtStop(unproven, [error("a", 3)], new Map(), texts), []);
  const proven = readTurn(null);
  markWrite(proven, { file: "a", written: "# T\n\nslot\n", replaced: "# T\n\nclean\n", whole: true });
  assert.deepEqual(requiredAtStop(proven, [error("a", 1, "H"), error("a", 3)], null, texts), [error("a", 3)]);
});

test("a patch or an edit adding lines and replacing none proves them", () => {
  const turn = readTurn(null);
  markWrite(turn, { file: "a", written: "slot" });
  assert.deepEqual(requiredAtStop(turn, [error("a", 3)], null, textOf({ a: "# T\n\nslot\n" })), [error("a", 3)]);
});

test("at Stop only an error on a changed line is required: no warning, no line-less error, none the baseline counts", () => {
  const turn = readTurn(null);
  markWrite(turn, { file: "a", written: "slot\nslot", replaced: "" });
  const texts = textOf({ a: "slot\nslot\nother\n" });
  const lineless = { file: "a", rule: "R", excerpt: "x", error: true };
  const warning = { ...error("a", 1), error: false };
  assert.deepEqual(requiredAtStop(turn, [lineless, warning, error("a", 3)], null, texts), []);
  // Two copies written, one already counted before the turn: one is new.
  const baseline = new Map([[JSON.stringify(["a", "R", "x"]), 1]]);
  assert.deepEqual(requiredAtStop(turn, [error("a", 1), error("a", 2)], baseline, texts), [error("a", 2)]);
});

test("an edit written inside a line touches that whole line, and a span reaching a touched line is on it", () => {
  const turn = readTurn(null);
  markWrite(turn, { file: "a", written: "{{x}}", replaced: "y" });
  const texts = textOf({ a: "# T\n\nsee {{x}} here\n" });
  assert.deepEqual(requiredAtStop(turn, [error("a", 3)], null, texts), [error("a", 3)]);
  const span = { ...error("a", 1), endLine: 3 };
  assert.deepEqual(requiredAtStop(turn, [span], null, texts), [span]);
});

test("a file that cannot be read requires nothing", () => {
  const turn = readTurn(null);
  markWrite(turn, { file: "gone", written: "slot", replaced: "" });
  assert.deepEqual(requiredAtStop(turn, [error("gone", 1)], null, textOf({})), []);
});

test("tellOnce: errors new against the baseline outside the written files, told once per turn, none without a baseline", () => {
  const baseline = new Map([[JSON.stringify(["b", "R", "x"]), 1]]);
  const told = new Map();
  const found = [error("a", 1), error("b", 1), error("b", 2), { ...error("c", 1), error: false }];
  assert.deepEqual(tellOnce(found, ["a"], null, told), []);
  assert.deepEqual(tellOnce(found, ["a"], baseline, told), [error("b", 2)]);
  assert.deepEqual(tellOnce(found, ["a"], baseline, told), []);
});

test("a turn keeps the files it wrote, proven or not, and what it was told, across writes", () => {
  withTmp(() => {
    const mark = turnMark(PLUGIN, SESSION);
    const first = readTurn(mark);
    markWrite(first, { file: "a", written: "x", whole: true });
    tellOnce([error("b", 1)], ["a"], new Map(), first.told);
    leaveTurn(mark, first);
    const second = readTurn(mark);
    assert.deepEqual([...second.files], ["a"]);
    assert.deepEqual(second.net.size, 0);
    assert.deepEqual(tellOnce([error("b", 1)], ["a"], new Map(), second.told), []);
  });
});

test("state written through a link planted at the mark replaces the link and never writes its target", () => {
  withTmp((tmp) => {
    const mark = turnMark(PLUGIN, SESSION);
    const target = path.join(tmp, "target");
    fs.writeFileSync(target, "kept");
    fs.symlinkSync(target, mark);
    const turn = readTurn(mark);
    markWrite(turn, { file: "a", written: "x", replaced: "" });
    leaveTurn(mark, turn);
    assert.equal(fs.readFileSync(target, "utf8"), "kept");
    assert.equal(fs.lstatSync(mark).isSymbolicLink(), false);
  });
});
