const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ENGINE = path.resolve(__dirname, "../../plugins/aidd-context/hooks/memory-lint.cjs");
const { lintFile, lintBank, RULES } = require(ENGINE);

const MEMORY = "aidd_docs/memory";
const words = (count, word = "word") => Array(count).fill(word).join(" ");

/** A throwaway project: `memory` maps a name under the bank to its text, `files` to anything else. */
function project(memory, files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "memory-lint-"));
  for (const [name, text] of Object.entries(memory)) write(root, `${MEMORY}/${name}`, text);
  for (const [name, text] of Object.entries(files)) write(root, name, text);
  return root;
}

function write(root, name, text) {
  const full = path.join(root, name);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
}

function lint(text, files = {}, others = {}) {
  const root = project({ "a.md": text, ...others }, files);
  try {
    return lintFile(root, `${MEMORY}/a.md`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const ids = (problems) => problems.map((problem) => problem.rule);

test("M1: a prose line over 25 words is an error on its line", () => {
  const problems = lint(`# T\n\n${words(26)}\n`);
  assert.deepEqual(problems.map(({ rule, severity, line }) => [rule, severity, line]), [["M1", "error", 3]]);
});

test("M1: 25 words, tables, lists, headings, quotes, comments and fences stay quiet", () => {
  const text = [
    "# " + words(30),
    words(25),
    "| " + words(30) + " |",
    "- " + words(30),
    "1. " + words(30),
    "> " + words(30),
    "<!-- " + words(30) + " -->",
    "<!--",
    words(30),
    "-->",
    "```",
    words(30),
    "```",
    "```mermaid",
    words(30),
    "```",
  ].join("\n");
  assert.deepEqual(ids(lint(text)).filter((id) => id === "M1"), []);
});

test("M2: counts of things, dates and time words are errors", () => {
  for (const line of [
    "Holds 12 commits.",
    "Across 3 branches today.",
    "About 40 files.",
    "7 tests pass.",
    "300 lines long.",
    "2 issues open.",
    "4 pull requests.",
    "5 PRs merged.",
    "9 users.",
    "8 records.",
    "6 runs.",
    "2 sessions.",
    "Dated 2026-01-31 here.",
    "It is currently slow.",
    "As of now it works.",
    "Fine right now.",
    "Down at the moment.",
  ]) {
    assert.deepEqual(ids(lint(`# T\n\n${line}\n`)), ["M2"], line);
  }
});

test("each error message names its excerpt and its fix", () => {
  const message = (text, files) => lint(text, files)[0].message;
  assert.equal(message(`# T\n\n${words(26)}\n`), "prose line of 26 words, over 25: make it a table, a list or a heading");
  assert.equal(message("# T\n\nWe have 41 commits.\n"), '"41 commits" goes stale: name the thing, not how many');
  assert.equal(message("# T\n\nShipped 2026-01-02.\n"), '"2026-01-02" goes stale: state what is true, not when');
  assert.equal(message("# T\n\nIt is Currently fine.\n"), '"Currently" goes stale: state what is true, not when');
  assert.equal(message("# T\n\nA {{slot}} here.\n"), '"{{" unfinished: fill it or remove it');
  assert.equal(message("# T\n\nDo TBD later.\n"), '"TBD" unfinished: fill it or remove it');
  assert.equal(message("# T\n\nSee `src/gone.cfg`.\n", { "src/here.cfg": "" }), "`src/gone.cfg` names nothing on disk: fix the path or remove it");
});

test("an excerpt over 40 characters is cut with an ellipsis", () => {
  const long = "x".repeat(60);
  assert.equal(lint(`# T\n\nSee \`src/${long}.cfg\`.\n`, { "src/here.cfg": "" })[0].message, `\`src/${"x".repeat(35)}…\` names nothing on disk: fix the path or remove it`);
});

// Counts as observed in the four real banks (framework root, cli, gouvernail, kairos-app).
const OBSERVED_COUNTS = [
  "9 plugins ship, 3 off the curated install path",
  "Config: `release-please-config.json`, eleven packages.",
  "vitest, four projects — see the CLI bank",
  "One interface for five tools",
  "`vitest.config.ts` composes two projects",
  "Three apps and twelve packages share one lockfile",
  "6 formats, 2 taps to start",
  "The suite holds 2718 tests across 582 files",
  "A mutation run kills 578 mutants",
  "Vitest holds 129 suites",
  "The browser lane boots eight containers",
  "Six routes and seven screens",
];

// Names, versions, times, ports and numbered lists as observed: a number that is not a count.
const OBSERVED_LOOK_ALIKES = [
  "Node >=22.12 and Node 22 on port 3000.",
  "Steps 1–2 run at scope user, see step 2.",
  "Vitest 5 uses canonical names for filtered runs.",
  "by luck (08:36 follows 07:24) and the gap",
  "v7.1 draws no screen of its own",
  "Tab map (4+1 tabs)",
  "1. Write the failing test first",
  "2) Rewrite the table",
  "One fact in one home, one exists per rule.",
  "It reports 12,065 unknown words.",
  "The hash 35466894742 contradicts the log.",
  "Six of its parts, 41 was the answer.",
];

test("M2: a count of any things, in digits or words, is an error", () => {
  for (const line of OBSERVED_COUNTS) assert.deepEqual(ids(lint(`# T\n\n${line}\n`)), ["M2"], line);
});

test("M2: a name, a version, a time, a port and a numbered list stay quiet", () => {
  for (const line of OBSERVED_LOOK_ALIKES) assert.deepEqual(ids(lint(`# T\n\n${line}\n`)), [], line);
});

test("M2: today, so far, a version, and a fence stay quiet", () => {
  const text = "# T\n\nToday it works.\n\nSo far so good.\n\nNode >=22.12 and Node 22 on port 3000.\n\nSteps 1–2 run at scope user, see step 2.\n\n```\n3 files 2026-01-01\n```\n";
  assert.deepEqual(ids(lint(text)), []);
});

test("M3: a template marker, TODO, TODO: and TBD are errors", () => {
  for (const line of ["Name {{ name }}", "TODO", "TODO: later", "Owner TBD"]) {
    assert.deepEqual(ids(lint(`# T\n\n${line}\n`)), ["M3"], line);
  }
});

test("M3: TODO'd and a word containing it stay quiet", () => {
  assert.deepEqual(ids(lint("# T\n\nThe item was TODO'd and the TODOS list is fine.\n")), []);
});

test("M4: a backticked path under a real top-level entry that does not exist is an error", () => {
  const problems = lint("# T\n\nSee `src/gone.cfg`.\n", { "src/here.cfg": "" });
  assert.deepEqual(problems.map(({ rule, line }) => [rule, line]), [["M4", 3]]);
});

test("M4: an existing path, an unknown head, a directory, a glob and a version stay quiet", () => {
  const text = "# T\n\n`src/here.cfg` `nowhere/x.cfg` `src/dir` `src/*.cfg` `>=22.12` `a b.cfg` `src/settings.local.json`\n";
  assert.deepEqual(ids(lint(text, { "src/here.cfg": "" })), []);
});

test("M5: a bullet or a table cell over 35 words is a warning", () => {
  const bullet = lint(`# T\n\n- ${words(36)}\n`);
  assert.deepEqual(bullet.map(({ rule, severity }) => [rule, severity]), [["M5", "warning"]]);
  const cell = lint(`# T\n\n| a | b |\n| - | - |\n| x | ${words(36)} |\n`);
  assert.deepEqual(ids(cell), ["M5"]);
  assert.deepEqual(ids(lint(`# T\n\n- ${words(35)}\n`)), []);
});

test("M6: a file over 400 words is a warning", () => {
  const body = Array(41).fill(`- ${words(10)}`).join("\n");
  const problems = lint(`# T\n\n${body}\n`);
  assert.deepEqual(problems.map(({ rule, severity }) => [rule, severity]), [["M6", "warning"]]);
  assert.deepEqual(ids(lint(`# T\n\n- ${words(30)}\n`)), []);
});

test("M7: a sentence of 12 words found in another memory file is a warning", () => {
  const sentence = "the quick brown fox jumps over the lazy dog every single morning again";
  const problems = lint(`# T\n\n- ${sentence}\n`, {}, { "b.md": `# B\n\n${sentence}.\n` });
  assert.deepEqual(problems.map(({ rule, severity, line }) => [rule, severity, line]), [["M7", "warning", 3]]);
  assert.deepEqual(ids(lint(`# T\n\n- ${sentence}\n`, {}, { "b.md": "# B\n\nsomething else entirely\n" })), []);
  assert.deepEqual(ids(lint(`# T\n\n- ${sentence}\n`, {}, { "b.md": "# B\n\nshort words only here\n" })), []);
});

test("errors come before warnings", () => {
  const problems = lint(`# T\n\n- ${words(36)}\n\nTBD\n`);
  assert.deepEqual(ids(problems), ["M3", "M5"]);
});

test("a rule that throws is one problem naming it, the others still report", () => {
  const rules = [{ id: "M9", severity: "error", check: () => { throw new Error("boom"); } }, ...RULES];
  const root = project({ "a.md": "# T\n\nTBD\n" });
  try {
    const problems = lintFile(root, `${MEMORY}/a.md`, rules);
    assert.deepEqual(ids(problems), ["M9", "M3"]);
    assert.match(problems[0].message, /M9.*boom/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("lintBank skips README.md and the read-on-demand folders", () => {
  const root = project({ "README.md": "TBD\n", "a.md": "# T\n", "b.md": "TBD\n", "internal/c.md": "TBD\n", "external/d.md": "TBD\n" });
  try {
    const problems = lintBank(root);
    assert.deepEqual(problems.map(({ file, rule }) => [file, rule]), [[`${MEMORY}/b.md`, "M3"]]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("lintFile gives nothing for a file under internal/ or external/", () => {
  const text = `# T\n\n${words(30)}\n\n- Date: 2026-09-01\n`;
  const root = project({ "internal/decisions/x.md": text, "external/y.md": text });
  try {
    assert.deepEqual(lintFile(root, `${MEMORY}/internal/decisions/x.md`), []);
    assert.deepEqual(lintFile(root, `${MEMORY}/external/y.md`), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("no memory folder gives no problem", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "memory-lint-"));
  try {
    assert.deepEqual(lintBank(root), []);
    const run = spawnSync("node", [ENGINE, root], { encoding: "utf8" });
    assert.equal(run.status, 0);
    assert.equal(run.stdout, "");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("script: prints one line per problem and exits 1 only with an error", () => {
  const root = project({ "a.md": "# T\n\nTBD\n\n- " + words(36) + "\n" });
  const warningOnly = project({ "a.md": `# T\n\n- ${words(36)}\n` });
  try {
    const failing = spawnSync("node", [ENGINE, root], { encoding: "utf8" });
    assert.equal(failing.status, 1);
    assert.match(failing.stdout, /^✗ .+:3: .+ \(M3\)\n⚠ .+:5: .+ \(M5\)\n$/);

    const passing = spawnSync("node", [ENGINE, warningOnly], { encoding: "utf8" });
    assert.equal(passing.status, 0);
    assert.match(passing.stdout, /^⚠ .+ \(M5\)\n$/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(warningOnly, { recursive: true, force: true });
  }
});

test("script: named files narrow the run", () => {
  const root = project({ "a.md": "TBD\n", "b.md": "# ok\n" });
  try {
    const run = spawnSync("node", [ENGINE, root, `${MEMORY}/b.md`], { encoding: "utf8" });
    assert.equal(run.status, 0);
    assert.equal(run.stdout, "");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
