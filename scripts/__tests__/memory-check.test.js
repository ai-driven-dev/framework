const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ENGINE = path.resolve(__dirname, "../../plugins/aidd-context/hooks/memory.cjs");
const { lintFile, lintBank, ALWAYS_WRITTEN, ROW_FILES } = require(ENGINE);
const { RULES } = require("../../plugins/aidd-context/hooks/lib/memory-rules.cjs");
const CAPABILITIES = path.resolve(__dirname, "../../plugins/aidd-context/skills/02-project-memory/references/capabilities.md");

const MEMORY = "aidd_docs/memory";
const words = (count, word = "word") => Array(count).fill(word).join(" ");

/** A throwaway project: `memory` maps a name under the bank to its text, `files` to anything else. */
function project(memory, files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "memory-check-"));
  for (const [name, text] of Object.entries(memory)) write(root, `${MEMORY}/${name}`, text);
  for (const [name, text] of Object.entries(files)) write(root, name, text);
  return root;
}

function write(root, name, text) {
  const full = path.join(root, name);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
}

/** The first question of the template named `name`, as a project leaves it when it never answers it. */
function slotOf(name, index = 0) {
  const templates = path.resolve(__dirname, "../../plugins/aidd-context/skills/02-project-memory/assets/templates/memory");
  return [...fs.readFileSync(path.join(templates, name), "utf8").matchAll(/\{\{[^{}\n]*\}\}/gu)][index][0];
}

function lint(text, files = {}, others = {}, name = "a.md") {
  const root = project({ [name]: text, ...others }, files);
  try {
    return lintFile(root, `${MEMORY}/${name}`);
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

// M1 counts words per sentence of the paragraph a reader sees, so a wrapped line is not an escape.
const m1 = (text) => lint(text).filter(({ rule }) => rule === "M1").map(({ line, endLine }) => [line, endLine]);

test("M1: a hard-wrapped sentence is counted whole and reported on every line it spans", () => {
  assert.deepEqual(m1(`# T\n\n${words(15)}\n${words(15)}\n`), [[3, 4]]);
  assert.deepEqual(m1(`# T\n\n${words(15)}\n${words(10)}\n`), []);
});

test("M1: sentences are counted apart: a long line of short sentences is quiet, a long sentence is not", () => {
  assert.deepEqual(m1(`# T\n\n${words(20)}. ${words(20)}. ${words(20)}.\n`), []);
  assert.deepEqual(m1(`# T\n\n${words(5)}. ${words(30)}.\n`), [[3, 3]]);
});

test("M1: a labelled line ending in a hard break is a unit of its own", () => {
  const labels = Array.from({ length: 5 }, (_, index) => `Owner ${index}: ${words(8)}  `).join("\n");
  assert.deepEqual(m1(`# T\n\n${labels}\n`), []);
});

test("M1: front matter, an HTML comment opened mid-line, list continuation lines and quotes are not prose", () => {
  assert.deepEqual(m1(`---\nsummary: ${words(30)}\n---\n# T\n`), []);
  assert.deepEqual(m1(`# T\n\nText <!-- start\n${words(30)}\n-->\n`), []);
  assert.deepEqual(m1(`# T\n\n- item\n  ${words(30)}\n${words(30)}\n`), []);
  assert.deepEqual(m1(`# T\n\n- item\n\n  ${words(30)}\n`), []);
  assert.deepEqual(m1(`# T\n\n- item\n\n${words(30)}\n`), [[5, 5]], "a prose line after the list is prose again");
});

test("M1: every fence form is code: nested, tilde, quoted, indented and indented inside a list", () => {
  const long = words(30);
  const forms = {
    nested: `\`\`\`\`md\n\`\`\`\n${long}\n\`\`\`\n${long}\n\`\`\`\`\n`,
    tilde: `~~~\n\`\`\`\n${long}\n~~~\n`,
    quoted: `> \`\`\`\n> ${long}\n> \`\`\`\n`,
    indented: `Intro.\n\n    ${long}\n`,
    inList: `- item\n\n  \`\`\`\n  ${long}\n  \`\`\`\n`,
  };
  for (const [form, body] of Object.entries(forms)) assert.deepEqual(m1(`# T\n\n${body}`), [], form);
  assert.deepEqual(m1(`# T\n\n~~~\n\`\`\`\n~~~\n${long}\n`), [[6, 6]], "a tilde fence is closed by a tilde, and prose follows");
});

test("M2: front matter is not read", () => {
  assert.deepEqual(ids(lint("---\nupdated: 2026-05-01\n---\n# T\n")), []);
});

test("M6: the 400 words are counted outside code and diagrams", () => {
  const code = `\`\`\`mermaid\n${Array(120).fill(`A --> B and C`).join("\n")}\n\`\`\`\n`;
  const body = Array(35).fill(`- ${words(10)}`).join("\n");
  assert.deepEqual(ids(lint(`# T\n\n${body}\n\n${code}`)), []);
  assert.deepEqual(ids(lint(`# T\n\n${Array(41).fill(`- ${words(10)}`).join("\n")}\n\n${code}`)), ["M6"]);
});

test("M2: a date is a warning, never an error", () => {
  assert.deepEqual(lint("# T\n\nDated 2026-01-31 here.\n").map(({ rule, severity }) => [rule, severity]), [["M2", "warning"]]);
});

test("each message names what is wrong, never its fix: the fix stands apart", () => {
  const message = (text, files) => lint(text, files)[0].message;
  assert.equal(message(`# T\n\n${words(26)}\n`), "sentence of 26 words, over the recommended 25");
  assert.equal(message("# T\n\nShipped 2026-01-02.\n"), '"2026-01-02" goes stale');
  assert.equal(message("# T\n\nSee `src/gone.cfg`.\n", { "src/here.cfg": "" }), "`src/gone.cfg` names nothing on disk");
});

test("each error carries its excerpt and its fix apart, as the findings formatter prints them", () => {
  const parts = (text, files) => {
    const [{ excerpt, fix }] = lint(text, files);
    return { excerpt, fix };
  };
  assert.deepEqual(parts(`# T\n\n${words(26)}\n`), { excerpt: "26 words, over the recommended 25", fix: "split it into a list or a table; keep every fact" });
  assert.deepEqual(parts("# T\n\nShipped 2026-01-02.\n"), { excerpt: "2026-01-02", fix: "check it against the code; keep it if true" });
  assert.deepEqual(parts("# T\n\nSee `src/gone.cfg`.\n", { "src/here.cfg": "" }), { excerpt: "src/gone.cfg", fix: "fix the path; keep the fact" });
  assert.deepEqual(parts(`# T\n\n- ${words(36)}\n`), { excerpt: undefined, fix: "split it; keep every fact" });
});

test("an excerpt over 40 characters is cut with an ellipsis", () => {
  const long = "x".repeat(60);
  assert.equal(lint(`# T\n\nSee \`src/${long}.cfg\`.\n`, { "src/here.cfg": "" })[0].message, `\`src/${"x".repeat(35)}…\` names nothing on disk`);
});

// Counts and time words as observed in real banks, in any language: telling a count that goes
// stale from a business constant needs judgment, so the reader rules own them, not the engine.
const COUNTS_AND_TIME_WORDS = [
  "9 plugins ship, 3 off the curated install path",
  "Config: `release-please-config.json`, eleven packages.",
  "The suite holds 2718 tests across 582 files",
  "Retention lasts 30 days.",
  "A pool of 100 connections.",
  "It is currently slow.",
  "HTML for now.",
  "Actuellement, le format est HTML.",
  "Pour l'instant douze routes.",
];

test("M2: a count or a time word stays quiet, whatever the language", () => {
  for (const line of COUNTS_AND_TIME_WORDS) assert.deepEqual(ids(lint(`# T\n\n${line}\n`)), [], line);
});

test("M2: a date in a fence stays quiet", () => {
  assert.deepEqual(ids(lint("# T\n\n```\n2026-01-01\n```\n")), []);
});

const VCS_SLOT = slotOf("vcs.md", 2);

test("M3: a slot copied from the template of the same name and left unfilled is an error, fences included", () => {
  const found = lint(`# VCS\n\n- ${VCS_SLOT}\n\n\`\`\`\n${VCS_SLOT}\n\`\`\`\n`, {}, {}, "vcs.md");
  assert.deepEqual(found.map(({ rule, severity, line }) => [rule, severity, line]), [["M3", "error", 3], ["M3", "error", 6]]);
});

test("M3: a slot of another template, a {{ of GitHub Actions, TODO and TBD are never flagged", () => {
  const text = [
    "# VCS",
    "",
    "- Publish reads `${{ secrets.NPM_TOKEN }}`.",
    "- Handlebars: `{{user.name}}`",
    "- No TODO left in code: open an issue instead.",
    "- TBD",
    "",
    "```yaml",
    "token: ${{ secrets.X }}",
    "```",
    `- ${slotOf("testing.md", 0)}`,
  ].join("\n");
  assert.deepEqual(ids(lint(text, {}, {}, "vcs.md")), []);
  assert.deepEqual(ids(lint(`# T\n\n- ${VCS_SLOT}\n`)), [], "a file with no template of its name has no slot");
});

test("M3: every question of every template is found when its file keeps it", () => {
  for (const name of ["architecture.md", "ecosystem.md", "ui.md"]) {
    const text = `# T\n\n- ${slotOf(name, 0)}\n`;
    assert.deepEqual(ids(lint(text, {}, {}, name)), ["M3"], name);
  }
});

// Where a build puts the hooks and the skill's templates, as `aidd translate --as flat` lays them
// out per tool, the plugin tree, and a skill carrying its own copy of the hooks.
const LAYOUTS = {
  "plugin tree": ["hooks", "skills/02-project-memory"],
  claude: [".claude/hooks/aidd-context", ".claude/skills/aidd-context-02-project-memory"],
  cursor: [".cursor/hooks/aidd-context", ".cursor/skills/aidd-context-02-project-memory"],
  copilot: [".github/hooks/aidd-context", ".github/skills/aidd-context-02-project-memory"],
  codex: [".codex/hooks/aidd-context", ".agents/skills/aidd-context-02-project-memory"],
  opencode: [".opencode/hooks/aidd-context", ".opencode/skills/aidd-context/02-project-memory"],
  kilo: [".kilo/hooks/aidd-context", ".kilo/skills/aidd-context/02-project-memory"],
  "skill copy": ["skills/02-project-memory/hooks", "skills/02-project-memory"],
};

test("M3 finds the templates in every layout a build produces, and flags nothing without them", () => {
  const plugin = path.resolve(__dirname, "../../plugins/aidd-context");
  for (const [layout, [hooks, skill]] of Object.entries(LAYOUTS)) {
    for (const withTemplates of [true, false]) {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "memory-layout-"));
      try {
        fs.cpSync(path.join(plugin, "hooks"), path.join(root, hooks), { recursive: true });
        if (withTemplates) fs.cpSync(path.join(plugin, "skills/02-project-memory/assets/templates"), path.join(root, skill, "assets/templates"), { recursive: true });
        const script = `const { RULES } = require(${JSON.stringify(path.join(root, hooks, "lib/memory-rules.cjs"))});\nconsole.log(RULES.find((rule) => rule.id === "M3").check({ file: "aidd_docs/memory/vcs.md", text: process.argv[1] }).length);`;
        const run = spawnSync(process.execPath, ["-e", script, `# V\n\n- ${slotOf("vcs.md", 2)}\n`], { encoding: "utf8" });
        assert.equal(run.stdout.trim(), withTemplates ? "1" : "0", `${layout}${withTemplates ? "" : " without templates"}: ${run.stderr}`);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    }
  }
});

test("M3: with no templates folder beside the library, nothing is flagged", () => {
  const [rule] = RULES.filter(({ id }) => id === "M3");
  const none = rule.check({ file: `${MEMORY}/vcs.md`, text: `# T\n\n- ${VCS_SLOT}\n`, templates: null });
  assert.deepEqual(none, []);
});

test("M4: a backticked path under a real top-level entry that does not exist is an error", () => {
  const problems = lint("# T\n\nSee `src/gone.cfg`.\n", { "src/here.cfg": "" });
  assert.deepEqual(problems.map(({ rule, line }) => [rule, line]), [["M4", 3]]);
});

test("M4: an existing path, an unknown head, a directory, a glob and a version stay quiet", () => {
  const text = "# T\n\n`src/here.cfg` `nowhere/x.cfg` `src/dir` `src/*.cfg` `>=22.12` `a b.cfg` `src/settings.local.json`\n";
  assert.deepEqual(ids(lint(text, { "src/here.cfg": "" })), []);
});

test("M4: a path that exists beside the citing file is a sibling, not a dead path", () => {
  const files = { "ARCHITECTURE.md": "" };
  assert.deepEqual(ids(lint("# T\n\nSee `architecture.md`.\n", files, { "architecture.md": "# A\n" })), []);
  assert.deepEqual(ids(lint("# T\n\nSee `architecture.md`.\n", files, { "other.md": "# O\n" })), ["M4"]);
});

test("M5: a bullet or a table cell over 35 words is a warning", () => {
  const bullet = lint(`# T\n\n- ${words(36)}\n`);
  assert.deepEqual(bullet.map(({ rule, severity }) => [rule, severity]), [["M5", "warning"]]);
  const cell = lint(`# T\n\n| a | b |\n| - | - |\n| x | ${words(36)} |\n`);
  assert.deepEqual(ids(cell), ["M5"]);
  assert.deepEqual(ids(lint(`# T\n\n- ${words(35)}\n`)), []);
});

test("M5 and M6 name the count over the recommendation and a fix that keeps every fact", () => {
  const [m5] = lint(`# T\n\n- ${words(36)}\n`);
  assert.deepEqual([m5.message, m5.fix], ["bullet or cell of 36 words, over the recommended 35", "split it; keep every fact"]);
  const m6 = lint(`# T\n\n${Array(41).fill(words(10) + ".").join("\n")}\n`).find((problem) => problem.rule === "M6");
  assert.match(m6.message, /^file of \d+ words, over the recommended 400$/u);
  assert.equal(m6.fix, "move a section to the capability file it belongs to; keep every fact");
});

test("M6: a file over 400 words is a warning", () => {
  const body = Array(41).fill(`- ${words(10)}`).join("\n");
  const problems = lint(`# T\n\n${body}\n`);
  assert.deepEqual(problems.map(({ rule, severity }) => [rule, severity]), [["M6", "warning"]]);
  assert.deepEqual(ids(lint(`# T\n\n- ${words(30)}\n`)), []);
});

test("M7: a sentence of 12 words found in another memory file is a warning naming that file", () => {
  const sentence = "the quick brown fox jumps over the lazy dog every single morning again";
  const problems = lint(`# T\n\n- ${sentence}\n`, {}, { "b.md": `# B\n\n${sentence}.\n` });
  assert.deepEqual(problems.map(({ rule, severity, line, excerpt }) => [rule, severity, line, excerpt]), [["M7", "warning", 3, "aidd_docs/memory/b.md"]]);
  assert.deepEqual(ids(lint(`# T\n\n- ${sentence}\n`, {}, { "b.md": "# B\n\nsomething else entirely\n" })), []);
  assert.deepEqual(ids(lint(`# T\n\n- ${sentence}\n`, {}, { "b.md": "# B\n\nshort words only here\n" })), []);
});

test("errors come before warnings", () => {
  const problems = lint(`# T\n\n- ${words(36)}\n\n${words(26)}\n`);
  assert.deepEqual(ids(problems), ["M1", "M5"]);
});

test("a rule that throws drops out of the findings, the others still report", () => {
  const rules = [{ id: "M9", severity: "error", check: () => { throw new Error("boom"); } }, ...RULES];
  const root = project({ "a.md": `# T\n\n${words(26)}\n` });
  try {
    assert.deepEqual(ids(lintFile(root, `${MEMORY}/a.md`, rules)), ["M1"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("check names a rule that throws once, as an internal error and never a finding, and fails", () => {
  const root = fullBank({ "a.md": "# T\n\nShort.\n", "b.md": "# B\n\nShort.\n" });
  const preload = path.join(root, "throw.js");
  try {
    const rules = path.resolve(__dirname, "../../plugins/aidd-context/hooks/lib/memory-rules.cjs");
    fs.writeFileSync(preload, `const { RULES } = require(${JSON.stringify(rules)});\nRULES.find((rule) => rule.id === "M3").check = () => { throw new Error("boom"); };\n`);
    const run = spawnSync("node", ["--require", preload, ENGINE, "check", root], { encoding: "utf8" });
    assert.equal(run.status, 1);
    assert.match(run.stdout, /^aidd-context: 0 errors, 1 warning\n\S+ load warning [^\n]+\n$/u);
    assert.equal(run.stderr, "aidd-context: internal error: rule M3 failed: boom\n");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("lintBank skips README.md and the read-on-demand folders", () => {
  const long = `${words(26)}\n`;
  const root = project({ "README.md": long, "a.md": "# T\n", "b.md": long, "internal/c.md": long, "external/d.md": long });
  try {
    const problems = lintBank(root);
    assert.deepEqual(problems.map(({ file, rule }) => [file, rule]), [[`${MEMORY}/b.md`, "M1"]]);
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

test("no memory folder gives no lint problem, and check fails: a gate that checked nothing passes nothing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "memory-check-"));
  try {
    assert.deepEqual(lintBank(root), []);
    const run = spawnSync("node", [ENGINE, "check", root], { encoding: "utf8" });
    assert.equal(run.status, 1);
    assert.equal(run.stdout, 'aidd-context: 1 error, 0 warnings\naidd_docs/memory missing "no memory bank under the root" => write it with the project memory skill\n');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/** A bank holding every always-written file, clean, then `memory` over it. */
function fullBank(memory, files = {}) {
  return project({ ...Object.fromEntries(ALWAYS_WRITTEN.map((name) => [name, "# T\n\nShort.\n"])), ...memory }, files);
}

function check(root, ...files) {
  return spawnSync("node", [ENGINE, "check", root, ...files], { encoding: "utf8" });
}

test("check prints the findings in the contract's shape and exits 1 only with an error", () => {
  const root = fullBank({ "a.md": `# T\n\n${words(26)}\n\n- ${words(36)}\n` });
  const warningOnly = fullBank({ "a.md": `# T\n\n- ${words(36)}\n` });
  try {
    const failing = check(root);
    assert.equal(failing.status, 1);
    assert.equal(
      failing.stdout,
      'aidd-context: 1 error, 2 warnings\naidd_docs/memory/a.md:3 M1 "26 words, over the recommended 25" => split it into a list or a table; keep every fact\naidd_docs/memory/a.md:5 M5 warning bullet or cell of 36 words, over the recommended 35 => split it; keep every fact\n' +
        "aidd_docs/memory load warning every session loads 86 words, markup included, from 8 files => move what a session rarely needs to internal/ or external/\n"
    );

    const passing = check(warningOnly);
    assert.equal(passing.status, 0);
    assert.match(passing.stdout, /^aidd-context: 0 errors, 2 warnings\n.+ M5 warning .+\n.+ load warning .+\n$/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(warningOnly, { recursive: true, force: true });
  }
});

test("check warns the words every session loads: the root files only, on a whole-bank run, and exits 0", () => {
  const root = fullBank({ "a.md": `# T\n\n${Array(4).fill(words(25)).join("\n\n")}\n`, "internal/b.md": words(500), "external/c.md": words(500), "README.md": words(300) });
  try {
    const run = check(root);
    assert.equal(run.status, 0);
    // Seven always-written files of three words each, plus the hundred and two of a.md.
    assert.equal(
      run.stdout,
      "aidd-context: 0 errors, 1 warning\naidd_docs/memory load warning every session loads 123 words, markup included, from 8 files => move what a session rarely needs to internal/ or external/\n"
    );
    assert.equal(check(root, `${MEMORY}/a.md`).stdout, "", "a named file narrows the run: no load figure");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("check names the always-written files the bank lacks as the one error, and the layout as warnings", () => {
  const root = project({ "vcs.md": "# V\n", "kpi/x.md": "# K\n", "kpi/y.md": "# K\n", "internal/y.md": "TBD\n", "external/z.md": "TBD\n" });
  try {
    const run = check(root);
    assert.equal(run.status, 1);
    assert.deepEqual(run.stdout.split("\n").slice(0, -1), [
      "aidd-context: 1 error, 2 warnings",
      'aidd_docs/memory missing "project-brief.md, architecture.md, codebase-map.md, coding-assertions.md, testing.md, ecosystem.md" => write each from its template',
      "aidd_docs/memory/kpi/ placement warning a folder outside the bank's root, internal/ and external/ => move aidd_docs/memory/kpi/ to aidd_docs/memory/internal/kpi/, or to the aidd_docs/ folder of the plugin that owns it",
      "aidd_docs/memory load warning every session loads 2 words, markup included, from 1 file => move what a session rarely needs to internal/ or external/",
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("check: an always file under an accepted name of its row is not missing", () => {
  const files = Object.fromEntries(ALWAYS_WRITTEN.filter((name) => name !== "ecosystem.md").map((name) => [name, "# T\n\nShort.\n"]));
  const root = project({ ...files, "integration.md": "# G\n" });
  try {
    const run = check(root);
    assert.equal(run.status, 0);
    assert.doesNotMatch(run.stdout, /missing/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// Where a file sits is the team's choice: the root loads every session, internal/ and external/ on demand.
test("check: a row's file in internal/ is the team's choice, a folder outside every loading rule is a warning", () => {
  const root = fullBank({ "internal/auth.md": "# A\n", "kpi/q.md": "# K\n", "assets/diagram.png": "x" });
  try {
    const run = check(root);
    assert.equal(run.status, 0);
    assert.deepEqual(run.stdout.split("\n").slice(0, -1), [
      "aidd-context: 0 errors, 3 warnings",
      "aidd_docs/memory/assets/ placement warning a folder outside the bank's root, internal/ and external/ => move aidd_docs/memory/assets/ to aidd_docs/memory/internal/assets/, or to the aidd_docs/ folder of the plugin that owns it",
      "aidd_docs/memory/kpi/ placement warning a folder outside the bank's root, internal/ and external/ => move aidd_docs/memory/kpi/ to aidd_docs/memory/internal/kpi/, or to the aidd_docs/ folder of the plugin that owns it",
      "aidd_docs/memory load warning every session loads 21 words, markup included, from 7 files => move what a session rarely needs to internal/ or external/",
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("check: an always-written file the team keeps in internal/ or external/ is present", () => {
  const root = fullBank({ "internal/testing.md": "# T\n" });
  try {
    fs.rmSync(path.join(root, MEMORY, "testing.md"));
    const run = check(root);
    assert.doesNotMatch(run.stdout, /testing\.md/u, run.stdout);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("check: a bank holding a team's cli.md and the names of older layouts gets no merge offer and no missing file", () => {
  const root = fullBank({ "cli.md": "# CLI\n", "design.md": "# D\n", "infra.md": "# I\n", "integration.md": "# G\n", "forms.md": "# F\n", "navigation.md": "# N\n" });
  try {
    const run = check(root);
    assert.equal(run.status, 0);
    assert.equal(run.stdout, "aidd-context: 0 errors, 1 warning\naidd_docs/memory load warning every session loads 33 words, markup included, from 13 files => move what a session rarely needs to internal/ or external/\n");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("check fails on a named file that does not exist, and on a root holding no bank", () => {
  const root = fullBank({});
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), "memory-check-"));
  try {
    const missing = check(root, `${MEMORY}/nope.md`);
    assert.equal(missing.status, 1);
    assert.equal(missing.stdout, 'aidd-context: 1 error, 0 warnings\naidd_docs/memory/nope.md missing "no such file" => write it or fix the name\n');
    assert.equal(check(bare, `${MEMORY}/vcs.md`).status, 1);
    assert.equal(check(path.join(bare, "src")).status, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(bare, { recursive: true, force: true });
  }
});

test("check resolves a root given through a link, and a file given by its real path", () => {
  const root = fullBank({ "a.md": `# T\n\n${words(26)}\n` });
  const link = `${root}-link`;
  try {
    fs.symlinkSync(root, link);
    const real = fs.realpathSync(root);
    const run = check(link, path.join(real, MEMORY, "a.md"));
    assert.equal(run.status, 1);
    assert.match(run.stdout, /aidd_docs\/memory\/a\.md:3 M1/u);
    assert.equal(check(link).status, 1);
  } finally {
    fs.rmSync(link, { force: true });
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// The cap of ten binds the hook's answer to the model only; a check by hand or in CI prints all.
test("check prints every warning, uncapped", () => {
  const root = fullBank(Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`f${index}.md`, `# T\n\n- ${words(36, `w${index}`)}\n`])));
  try {
    const lines = check(root).stdout.trim().split("\n");
    assert.equal(lines[0], "aidd-context: 0 errors, 13 warnings");
    assert.equal(lines.length, 14);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("check: named files narrow the run, and leave the missing files out", () => {
  const root = project({ "a.md": `${words(26)}\n`, "b.md": "# ok\n" });
  try {
    const run = check(root, `${MEMORY}/b.md`);
    assert.equal(run.status, 0);
    assert.equal(run.stdout, "");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the always-written files are the Always rows of the capability table", () => {
  const rows = fs
    .readFileSync(CAPABILITIES, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("|"))
    .map((line) => line.split("|").map((cell) => cell.trim()))
    .filter((cells) => cells[5] === "yes");
  const named = rows.flatMap((cells) => [...cells[2].matchAll(/`([^`]+\.md)`/gu)].map((match) => match[1]));
  assert.deepEqual([...ALWAYS_WRITTEN].sort(), named.sort());
});

// The engine's tables are the capability table's: one row per file, and the names a row accepts.
test("the engine's row files are the capability table's, and it holds no table of former names", () => {
  const rows = fs
    .readFileSync(CAPABILITIES, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("| `"))
    .map((line) => line.split("|").map((cell) => cell.trim()))
    .filter((cells) => cells.length === 8);
  const names = (cell) => [...cell.matchAll(/`([^`]+\.md)`/gu)].map((match) => match[1]);
  assert.deepEqual([...ROW_FILES].sort(), rows.flatMap((cells) => names(cells[2])).sort());
  assert.deepEqual(
    [...ALWAYS_WRITTEN].sort(),
    rows.filter((cells) => cells[5] === "yes").flatMap((cells) => names(cells[2])).sort()
  );
  for (const accepted of rows.flatMap((cells) => names(cells[6]))) assert.ok(!ROW_FILES.includes(accepted), `${accepted} is accepted and also a row file`);
  assert.equal(require(ENGINE).FORMER_FILES, undefined);
  const acceptedOfAlways = Object.fromEntries(
    rows.filter((cells) => cells[5] === "yes" && names(cells[6]).length > 0).map((cells) => [names(cells[2])[0], names(cells[6])])
  );
  assert.deepEqual(require(ENGINE).ACCEPTED_ALWAYS, acceptedOfAlways);
});

// report's lost lines: what a write lost without approval, against the bank at HEAD

function engine(...args) {
  return spawnSync("node", [ENGINE, ...args], { encoding: "utf8" });
}

const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));

function git(root, ...args) {
  // No background maintenance: it writes `.git/objects/maintenance.lock` while treeState reads the tree.
  const run = spawnSync("git", ["-C", root, "-c", "user.name=t", "-c", "user.email=t@t", "-c", "maintenance.auto=false", "-c", "gc.auto=0", ...args], { encoding: "utf8", env: cleanEnv() });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.trim();
}

/** Every file under `root`, `.git` included, as name and content hash: what a command must leave as it found it. */
function treeState(root, relative = "") {
  return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap((entry) => {
    const next = path.join(relative, entry.name);
    if (entry.isDirectory()) return treeState(root, next);
    return [`${next} ${crypto.createHash("sha1").update(fs.readFileSync(path.join(root, next))).digest("hex")}`];
  });
}

const BEFORE = "# V\n\n## Setup\n\n- keep one\n- release pipeline\n- keep two\n\n## Run\n\n- deployment checklist\n";
const dline = (id, target, fact, answer) => `- ${id} | ${target} | ${fact} | aidd_docs/memory/vcs.md | ${answer}`;
const approve = (line) => dline("D1", "vcs.md > Setup", `remove "${line}": stale`, "yes");

/** A temp repository whose HEAD commits `committed` (bank-relative names), then `working` written over it (null deletes). */
function repo(committed, working = {}) {
  const root = project(committed);
  git(root, "init", "-q");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "bank");
  for (const [name, text] of Object.entries(working)) {
    if (text === null) fs.rmSync(path.join(root, MEMORY, name));
    else write(root, `${MEMORY}/${name}`, text);
  }
  return root;
}

const SHEET_FILE = "aidd_docs/tasks/t/facts.md";

/** The lines a report lists lost, one `file: line` each, and status 1 when it lists any. */
function lostOf(run) {
  const block = run.stdout.match(/^Lines lost\n {2}No item[^\n]*\n((?: {2}[^\n]*\n?)*)/mu)?.[1] ?? "";
  const stdout = block.replace(/^ {2}/gmu, "");
  return { ...run, status: run.status !== 0 ? run.status : stdout === "" ? 0 : 1, stdout };
}

/** What `report` lists lost for a bank committed as `committed` and now `working`, against a sheet of `sheetLines`; the tree must be left untouched. */
function lostLines(committed, working, sheetLines = []) {
  const root = repo(committed, working);
  const sheetFile = path.join(root, SHEET_FILE);
  write(root, SHEET_FILE, sheet(...sheetLines));
  const before = treeState(root);
  try {
    const run = lostOf(engine("report", sheetFile));
    assert.deepEqual(treeState(root), before, "report wrote to the tree");
    return { run };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const LOSS = { "vcs.md": BEFORE.replace("- release pipeline\n", "") };

test("report, lost lines: a line gone with no D line answered yes is listed with exit 1, and nothing in the tree changes", () => {
  for (const answer of ["", "no"]) {
    const { run } = lostLines({ "vcs.md": BEFORE }, LOSS, [dline("D1", "vcs.md > Setup", 'remove "- release pipeline"', answer)]);
    assert.equal(run.status, 1, `answer "${answer}"`);
    assert.equal(run.stdout, "vcs.md: - release pipeline\n");
  }
  assert.equal(lostLines({ "vcs.md": BEFORE }, LOSS).run.status, 1);
});

test("report, lost lines: a line quoted by a remove or replace D line answered yes is not listed, exit 0", () => {
  for (const verb of ['remove "- release pipeline"', 'replace "- release pipeline" with "- another"']) {
    const { run } = lostLines({ "vcs.md": BEFORE }, LOSS, [dline("D1", "vcs.md > Setup", verb, "yes")]);
    assert.equal(run.status, 0, verb);
    assert.equal(run.stdout, "");
  }
});

// A model quotes a list line without its marker as often as with it.
test("report, lost lines: an approval may quote a list line without its marker", () => {
  const { run } = lostLines({ "vcs.md": BEFORE }, LOSS, [dline("D1", "vcs.md > Setup", 'replace "release pipeline" with "found"', "yes")]);
  assert.equal(run.stdout, "");
  assert.equal(run.status, 0);
});

test("report, lost lines: an approval covers the line it quotes and no other", () => {
  const two = { "vcs.md": BEFORE.replace("- release pipeline\n", "").replace("- deployment checklist\n", "") };
  const { run } = lostLines({ "vcs.md": BEFORE }, two, [approve("- release pipeline")]);
  assert.equal(run.stdout, "vcs.md: - deployment checklist\n");
});

test("report, lost lines: the approval needs a D id, a remove or replace verb and an answer starting with yes", () => {
  const listed = (line) => lostLines({ "vcs.md": BEFORE }, LOSS, [line]).run.stdout;
  assert.match(listed(dline("D1", "vcs.md > Setup", 'add "- release pipeline"', "yes")), /release pipeline/u, "not a removal");
  assert.match(listed(dline("R1", "vcs.md > Setup", 'remove "- release pipeline"', "yes")), /release pipeline/u, "not a D line");
  assert.match(listed(dline("D1", "vcs.md > Setup", "remove the release pipeline line", "yes")), /release pipeline/u, "the line is not quoted");
  assert.equal(listed(dline("D1", "vcs.md > Setup", 'remove "- release pipeline"', "Yes, drop it")), "");
});

test("report, lost lines: a line moved within its file or to another bank file is not listed, a duplicate copy gone is", () => {
  const moved = BEFORE.replace("- release pipeline\n", "").replace("- deployment checklist\n", "- deployment checklist\n- release pipeline\n");
  assert.equal(lostLines({ "vcs.md": BEFORE }, { "vcs.md": moved }).run.stdout, "");
  assert.equal(lostLines({ "vcs.md": BEFORE }, { ...LOSS, "internal/other.md": "- release pipeline\n" }).run.stdout, "");
  const twice = lostLines({ "vcs.md": "- duplicate\n- duplicate\n" }, { "vcs.md": "- duplicate\n" });
  assert.equal(twice.run.status, 1);
  assert.equal(twice.run.stdout, "vcs.md: - duplicate\n");
});

test("report, lost lines: a heading left empty by approved removals is not a lost fact", () => {
  const before = { "vcs.md": "# V\n\n## Conventions\n\n- release pipeline\n" };
  const after = { "vcs.md": "# V\n" };
  assert.equal(lostLines(before, after, [approve("- release pipeline")]).run.stdout, "");
});

// A real bank wraps its prose at a fixed width: a line is a piece of a sentence, and an approved
// rewrite turns it into a list. What counts is a word the bank no longer holds, not a line.
const WRAPPED = "# T\n\nThe checks run before every release, and the pipeline keeps 14\ntables under review. Failures block the deployment.\n";

test("report, lost lines: a wrapped paragraph rewritten as a list with every word kept loses nothing", () => {
  const listed = "# T\n\n- The checks run before every release.\n- The pipeline keeps 14 tables under review.\n- Failures block the deployment.\n";
  assert.equal(lostLines({ "vcs.md": WRAPPED }, { "vcs.md": listed }).run.stdout, "");
});

test("report, lost lines: the rewrite that drops a number, a path or a whole sentence lists the line it came from", () => {
  const noNumber = "# T\n\n- The checks run before every release.\n- The pipeline keeps tables under review.\n- Failures block the deployment.\n";
  assert.equal(lostLines({ "vcs.md": WRAPPED }, { "vcs.md": noNumber }).run.stdout, "vcs.md: The checks run before every release, and the pipeline keeps 14\n");
  const noSentence = "# T\n\n- The checks run before every release.\n- The pipeline keeps 14 tables under review.\n";
  assert.equal(lostLines({ "vcs.md": WRAPPED }, { "vcs.md": noSentence }).run.stdout, "vcs.md: tables under review. Failures block the deployment.\n");
  const reworded = "# T\n\n- The checks run before each release.\n- The pipeline keeps 14 tables under review.\n- Failures block the deployment.\n";
  assert.equal(lostLines({ "vcs.md": WRAPPED }, { "vcs.md": reworded }).run.stdout, "", "one short word changed is a rewording");
});

test("report, lost lines: an approved move rewrites the paths it names before anything counts as lost", () => {
  const before = { "vcs.md": "# V\n\n- See aidd_docs/memory/kpi/index.md for the indicators.\n" };
  const after = { "vcs.md": "# V\n\n- See aidd_docs/memory/internal/kpi/index.md for the indicators.\n" };
  const move = dline("D1", "vcs.md > Setup", "move aidd_docs/memory/kpi to aidd_docs/memory/internal/kpi", "yes");
  assert.equal(lostLines(before, after, [move]).run.stdout, "");
  assert.equal(lostLines(before, before, [move]).run.stdout, "", "a move approved and not made yet loses nothing");
  assert.match(lostLines(before, after).run.stdout, /kpi\/index\.md/u, "an unapproved path change is a loss");
});

test("report, lost lines: a file with a non-ASCII name is guarded, and a file deleted from the working tree is listed whole", () => {
  assert.equal(lostLines({ "décisions.md": "- conservée\n- supprimée\n" }, { "décisions.md": "- conservée\n" }).run.stdout, "décisions.md: - supprimée\n");
  const gone = lostLines({ "internal/x.md": "- maintained\n" }, { "internal/x.md": null });
  assert.equal(gone.run.status, 1);
  assert.equal(gone.run.stdout, "internal/x.md: - maintained\n");
});

test("report, lost lines: no repository, or a bank never committed, lists nothing lost", () => {
  const plain = project({ "vcs.md": BEFORE });
  const fresh = project({ "vcs.md": BEFORE });
  git(fresh, "init", "-q");
  try {
    for (const root of [plain, fresh]) {
      write(root, SHEET_FILE, sheet());
      const run = engine("report", path.join(root, SHEET_FILE));
      assert.equal(run.status, 0);
      assert.match(run.stdout, /^Memory ready\n/u);
      assert.doesNotMatch(run.stdout, /Lines lost/u);
    }
  } finally {
    fs.rmSync(plain, { recursive: true, force: true });
    fs.rmSync(fresh, { recursive: true, force: true });
  }
});

test("report, lost lines: a git failure in a repository says the losses were not checked, with its reason, and a missing sheet is a clean error", () => {
  const root = repo({ "vcs.md": BEFORE }, LOSS);
  write(root, SHEET_FILE, sheet());
  try {
    const missing = engine("report", path.join(root, "aidd_docs/tasks/t/absent.md"));
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /absent\.md not read/u);
    assert.doesNotMatch(missing.stderr, /\n\s+at /u);
    const tree = git(root, "rev-parse", `HEAD:${MEMORY}`);
    const object = path.join(root, ".git/objects", tree.slice(0, 2), tree.slice(2));
    fs.chmodSync(object, 0o600);
    fs.rmSync(object);
    const broken = engine("report", path.join(root, SHEET_FILE));
    assert.equal(broken.status, 0);
    assert.match(broken.stdout, /^Memory written, lost lines not checked\n\nLines lost\n {2}not checked: git /u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("report, lost lines: reads the repository of the root even when a hook exported GIT_DIR", () => {
  const root = repo({ "vcs.md": BEFORE }, LOSS);
  write(root, SHEET_FILE, sheet());
  try {
    const run = lostOf(spawnSync("node", [ENGINE, "report", path.join(root, SHEET_FILE)], { encoding: "utf8", env: { ...process.env, GIT_DIR: path.join(os.tmpdir(), "no-such-git-dir") } }));
    assert.equal(run.stdout, "vcs.md: - release pipeline\n");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// changes: what an update starts from, read-only, computed from the last commit that touched the bank

const BANK_TEXT = "# Map\n\n- Entry: app/a.ts starts it\n- Three workspace packages in total.\n- Unrelated: app/b.ts\n";

/** A repository whose first commit holds the bank, then `after(root)` runs; returns the root. */
function history(after, memory = { "codebase-map.md": BANK_TEXT, "vcs.md": "# V\n\n- hooks run `make lint-all`\n" }) {
  const root = project(memory, { "app/a.ts": "a\n", "app/b.ts": "b\n", Makefile: "check:\n", "pnpm-workspace.yaml": "packages: [a]\n" });
  git(root, "init", "-q");
  commitAll(root, "bank written");
  after(root);
  return root;
}

function commitAll(root, message) {
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", message);
}

/** What `changes` prints on `root`, which it must leave byte-identical. */
function changes(root, ...args) {
  const before = treeState(root);
  const run = engine("changes", root, ...args);
  assert.deepEqual(treeState(root), before, "changes wrote to the tree");
  return run;
}

const cleanup = (...roots) => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true }));

test("changes: after a bank commit then a code commit it names the base, the changed file and the memory line citing it", () => {
  const root = history((dir) => {
    write(dir, "app/a.ts", "a2\n");
    write(dir, "app/new.ts", "n\n");
    commitAll(dir, "code moved on");
  });
  try {
    const run = changes(root);
    const base = git(root, "rev-parse", "--short", "HEAD~1");
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, new RegExp(`^Since ${base} \\(bank written\\), \\d+ seconds? ago: 1 commit, 2 files changed\n`, "u"), run.stdout);
    assert.match(run.stdout, /^changed \(2\):\n- app\/a\.ts\n- app\/new\.ts$/mu);
    assert.match(run.stdout, /aidd_docs\/memory\/codebase-map\.md:3 cites app\/a\.ts/u);
    assert.doesNotMatch(run.stdout, /app\/b\.ts/u, "an unchanged path is named");
  } finally {
    cleanup(root);
  }
});

test("changes: the first line says, for information, since when: the base, its age from git, the commits and the files changed since", () => {
  const days = (count) => `${Math.floor(Date.now() / 1000) - count * 86400} +0000`;
  const dated = (root, message, when) => {
    git(root, "add", "-A");
    const run = spawnSync("git", ["-C", root, "-c", "user.name=t", "-c", "user.email=t@t", "-c", "maintenance.auto=false", "-c", "gc.auto=0", "commit", "-q", "-m", message], {
      encoding: "utf8",
      env: { ...cleanEnv(), GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when },
    });
    assert.equal(run.status, 0, run.stderr);
  };
  const root = project({ "codebase-map.md": BANK_TEXT }, { "app/a.ts": "a\n", "app/b.ts": "b\n" });
  git(root, "init", "-q");
  dated(root, "bank written (first)", days(3));
  write(root, "app/a.ts", "a2\n");
  dated(root, "code one", days(2));
  write(root, "app/b.ts", "b2\n");
  dated(root, "code two", days(1));
  write(root, "app/c.ts", "untracked\n");
  try {
    const run = spawnSync("node", [ENGINE, "changes", root], { encoding: "utf8", env: { ...process.env, LC_ALL: "fr_FR.UTF-8", LANG: "fr_FR.UTF-8" } });
    assert.equal(run.status, 0, run.stderr);
    const base = git(root, "rev-parse", "--short", "HEAD~2");
    assert.equal(run.stdout.split("\n")[0], `Since ${base} (bank written (first)), 3 days ago: 2 commits, 3 files changed`);
  } finally {
    cleanup(root);
  }
});

test("changes: uncommitted and untracked files are changed files, and the bank's own files are not", () => {
  const root = history((dir) => {
    write(dir, "app/a.ts", "edited\n");
    write(dir, "app/untracked.ts", "u\n");
    write(dir, `${MEMORY}/vcs.md`, "# V\n\n- hooks run `make check`\n");
  });
  try {
    const run = changes(root);
    assert.match(run.stdout, /^- app\/a\.ts$/mu);
    assert.match(run.stdout, /^- app\/untracked\.ts$/mu);
    assert.match(run.stdout, /^changed \(2\):$/mu, "the bank's own edit is counted");
  } finally {
    cleanup(root);
  }
});

test("changes: a deleted path that a memory line cites is named with that line", () => {
  const root = history((dir) => {
    fs.rmSync(path.join(dir, "app/b.ts"));
    commitAll(dir, "drop b");
  });
  try {
    assert.match(changes(root).stdout, /codebase-map\.md:5 cites app\/b\.ts/u);
  } finally {
    cleanup(root);
  }
});

test("changes: --since overrides the base", () => {
  const root = history((dir) => {
    write(dir, "app/a.ts", "a2\n");
    commitAll(dir, "code one");
    write(dir, "app/b.ts", "b2\n");
    commitAll(dir, "code two");
  });
  try {
    assert.match(changes(root).stdout, /^- app\/a\.ts\n- app\/b\.ts$/mu);
    const since = changes(root, "--since", "HEAD~1");
    assert.match(since.stdout, /^Since \S+ \(code one\), [^:]+: 1 commit, 1 file changed$/mu, since.stdout);
    assert.match(since.stdout, /^changed \(1\):\n- app\/b\.ts$/mu);
  } finally {
    cleanup(root);
  }
});

test("changes: the base is the last commit that touched the bank, not the first", () => {
  const root = history((dir) => {
    write(dir, "app/a.ts", "a2\n");
    commitAll(dir, "code one");
    write(dir, `${MEMORY}/vcs.md`, "# V\n\n- hooks run `make check`\n");
    commitAll(dir, "bank touched again");
    write(dir, "app/b.ts", "b2\n");
    commitAll(dir, "code two");
  });
  try {
    const out = changes(root).stdout;
    assert.ok(out.includes("bank touched again"), out);
    assert.match(out, /^changed \(1\):\n- app\/b\.ts$/mu);
  } finally {
    cleanup(root);
  }
});

test("changes: no repository, no commit, or a bank never committed is an audit with its reason, exit 0", () => {
  const plain = project({ "vcs.md": BEFORE });
  const empty = project({ "vcs.md": BEFORE });
  git(empty, "init", "-q");
  const unbanked = project({}, { "app/a.ts": "a\n" });
  git(unbanked, "init", "-q");
  commitAll(unbanked, "code only");
  write(unbanked, `${MEMORY}/vcs.md`, BEFORE);
  try {
    for (const [root, reason] of [[plain, "no repository"], [empty, "no commit"], [unbanked, "bank never committed"]]) {
      const run = changes(root);
      assert.equal(run.status, 0, reason);
      assert.equal(run.stdout, `Since: no history, full review\nreason: ${reason}\n`);
    }
  } finally {
    cleanup(plain, empty, unbanked);
  }
});

test("changes: a base missing from a shallow history is an audit with its reason", () => {
  const origin = history((dir) => {
    write(dir, "app/a.ts", "a2\n");
    commitAll(dir, "code one");
    write(dir, "app/b.ts", "b2\n");
    commitAll(dir, "code two");
  });
  const clone = path.join(os.tmpdir(), `memory-shallow-${process.pid}`);
  try {
    const run = spawnSync("git", ["clone", "-q", "--depth", "1", `file://${origin}`, clone], { encoding: "utf8", env: cleanEnv() });
    assert.equal(run.status, 0, run.stderr);
    const audit = "Since: no history, full review\nreason: base missing from a shallow history\n";
    assert.equal(changes(clone).stdout, audit);
    assert.equal(changes(clone, "--since", git(origin, "rev-parse", "HEAD~2")).stdout, audit);
  } finally {
    cleanup(origin, clone);
  }
});

test("changes: an unknown --since reference, or one that is an option, is an error with exit 1", () => {
  const root = history((dir) => {
    write(dir, "app/a.ts", "a2\n");
    commitAll(dir, "code");
  });
  try {
    for (const ref of ["no-such-ref", "--output=x"]) {
      const run = changes(root, "--since", ref);
      assert.equal(run.status, 1, ref);
      assert.equal(run.stdout, "");
      assert.match(run.stderr, ref.startsWith("-") ? /memory: --since --output=x is not a reference/u : /memory: --since no-such-ref names no commit/u);
    }
  } finally {
    cleanup(root);
  }
});

test("changes: a git failure in a repository is an audit with its reason on one line, exit 0", () => {
  const root = history((dir) => {
    write(dir, "app/a.ts", "a2\n");
    commitAll(dir, "code");
  });
  try {
    const tree = git(root, "rev-parse", `HEAD:${MEMORY}`);
    const object = path.join(root, ".git/objects", tree.slice(0, 2), tree.slice(2));
    fs.chmodSync(object, 0o600);
    fs.rmSync(object);
    const run = engine("changes", root);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /^Since: no history, full review\nreason: git \S+ failed: [^\n]+\n$/u);
  } finally {
    cleanup(root);
  }
});

test("changes: reads the repository of the root even when a hook exported GIT_DIR", () => {
  const root = history((dir) => {
    write(dir, "app/a.ts", "a2\n");
    commitAll(dir, "code");
  });
  try {
    const run = spawnSync("node", [ENGINE, "changes", root], { encoding: "utf8", env: { ...process.env, GIT_DIR: path.join(os.tmpdir(), "no-such-git-dir") } });
    assert.match(run.stdout, /^- app\/a\.ts$/mu);
  } finally {
    cleanup(root);
  }
});

/** `count` files named `<dir>/f<i>.ts` for each `[dir, count]`, in one commit after the bank. */
const spread = (layout) =>
  history((dir) => {
    for (const [name, count] of layout) for (let index = 0; index < count; index += 1) write(dir, `${name}${String(index).padStart(2, "0")}.ts`, "x\n");
    commitAll(dir, "many");
  });
const groupLines = (out) => out.split("\n").filter((line) => /^- .* \(\d+\)$/u.test(line));

test("changes: a long change set prints one count per top-level directory, root files apart, and no file", () => {
  const root = spread([["gen/f", 20], ["docs/d", 15], ["src/s", 12], ["top", 3]]);
  try {
    const out = changes(root).stdout;
    assert.match(out, /^changed \(50\):$/mu, "50 files are listed in full, so the threshold is above 50");
    assert.equal(groupLines(out).length, 0);
  } finally {
    cleanup(root);
  }
  const many = spread([["gen/f", 20], ["docs/d", 15], ["src/s", 12], ["top", 3], ["more", 4]]);
  try {
    const out = changes(many).stdout;
    assert.match(out, /^changed \(54\):$/mu);
    assert.deepEqual(groupLines(out), ["- gen/ (20)", "- docs/ (15)", "- src/ (12)", "- (root) (7)"]);
    assert.doesNotMatch(out, /^- gen\/f/mu, "a large set lists no file");
  } finally {
    cleanup(many);
  }
});

test("changes: a top-level directory holding more than half of the change is split by its second level", () => {
  const root = spread([["big/api/a", 40], ["big/db/b", 25], ["big/c", 2], ["other/o", 20]]);
  try {
    const groups = groupLines(changes(root).stdout);
    assert.deepEqual(groups, ["- big/api/ (40)", "- big/db/ (25)", "- other/ (20)", "- big/ (2)"]);
  } finally {
    cleanup(root);
  }
  const even = spread([["a/x/f", 30], ["b/x/f", 30]]);
  try {
    assert.deepEqual(groupLines(changes(even).stdout), ["- a/ (30)", "- b/ (30)"], "exactly half is not more than half");
  } finally {
    cleanup(even);
  }
});

test("changes: a memory line citing a directory is named with the changed files under it, whole segments only", () => {
  const memory = { "codebase-map.md": "# Map\n\n- Sockets live in libs/net/ and nowhere else\n- Layers: backend/infrastructure holds adapters\n- The app code and docs\n- Top: docs/ and libs/ hold it all\n- Both app/a.ts and app/ change\n- Nested libs/net/deep/ only\n" };
  const root = history((dir) => {
    for (const file of ["libs/net/a.c", "libs/net/b.c", "libs/net/deep/c.c", "libs/net/d.c", "libs/net/e.c", "libs/network/x.c", "backend/infrastructure/db/q.ts", "app/a.ts", "docs/readme.md"]) write(dir, file, "changed\n");
    commitAll(dir, "move");
  }, memory);
  try {
    const out = changes(root).stdout;
    assert.match(out, /codebase-map\.md:3 cites libs\/net\/ \(5 changed: libs\/net\/a\.c, libs\/net\/b\.c, libs\/net\/d\.c, \+2\): - Sockets/u, "a prefix of whole segments: the sibling libs/network is not counted");
    assert.match(out, /codebase-map\.md:4 cites backend\/infrastructure \(1 changed: backend\/infrastructure\/db\/q\.ts\)/u, "a directory cited without its slash");
    assert.doesNotMatch(out, /codebase-map\.md:5/u, "a word with no slash is prose, not a directory");
    assert.doesNotMatch(out, /codebase-map\.md:6/u, "a top-level directory is too broad to name");
    assert.match(out, /codebase-map\.md:7 cites app\/a\.ts:/u, "a changed file wins over its directory");
    assert.match(out, /codebase-map\.md:8 cites libs\/net\/deep\/ \(1 changed: libs\/net\/deep\/c\.c\)/u);
    assert.ok(out.indexOf("cited (") < out.indexOf("changed ("), "memory lines first");
  } finally {
    cleanup(root);
  }
});

test("changes: --since=<ref>, a second root or any other option is an error with exit 1", () => {
  const root = history((dir) => {
    write(dir, "app/a.ts", "a2\n");
    commitAll(dir, "code");
  });
  try {
    for (const args of [["--since=HEAD~1"], ["--since", "HEAD~1", "other"], ["--verbose"], ["--since"]]) {
      const run = changes(root, ...args);
      assert.equal(run.status, 1, args.join(" "));
      assert.equal(run.stdout, "");
      assert.match(run.stderr, /memory: /u, args.join(" "));
    }
    assert.equal(changes(root, "--since", "HEAD~1").status, 0);
  } finally {
    cleanup(root);
  }
});

test("changes: a memory line citing a path with a non-ASCII name is named", () => {
  const root = history((dir) => {
    write(dir, "app/é.ts", "e\n");
    commitAll(dir, "accent");
  }, { "codebase-map.md": "# Map\n\n- Entry: app/é.ts starts it\n" });
  try {
    assert.match(changes(root).stdout, /codebase-map\.md:3 cites app\/é\.ts/u);
  } finally {
    cleanup(root);
  }
});

test("changes: a renamed file names its old path, so the line citing it is found", () => {
  const root = history((dir) => {
    git(dir, "mv", "app/b.ts", "app/c.ts");
    commitAll(dir, "rename b");
  });
  try {
    const out = changes(root).stdout;
    assert.match(out, /^- app\/b\.ts$/mu);
    assert.match(out, /codebase-map\.md:5 cites app\/b\.ts/u);
  } finally {
    cleanup(root);
  }
});

test("changes: a root below the repository's top lists only its own files, relative to it", () => {
  const top = fs.mkdtempSync(path.join(os.tmpdir(), "memory-sub-"));
  const root = path.join(top, "pkg");
  write(top, "pkg/aidd_docs/memory/codebase-map.md", "# Map\n\n- Entry: app/a.ts starts it\n");
  write(top, "pkg/app/a.ts", "a\n");
  write(top, "outside.ts", "o\n");
  git(top, "init", "-q");
  commitAll(top, "bank written");
  write(top, "pkg/app/a.ts", "a2\n");
  write(top, "outside.ts", "o2\n");
  try {
    const out = changes(root).stdout;
    assert.match(out, /^changed \(1\):\n- app\/a\.ts$/mu);
    assert.match(out, /codebase-map\.md:3 cites app\/a\.ts/u);
    assert.doesNotMatch(out, /outside/u);
  } finally {
    cleanup(top);
  }
});

// plan's sheet check: a sheet that cites nothing real must not reach the person

const SHEET_HEAD = "# Facts: setup\n\n- Scope: setup\n- Capabilities: C1 api\n\n";
const sheet = (...lines) => `${SHEET_HEAD}## Read\n\n${lines.join("\n")}\n`;
const GOOD = "- R1 | architecture.md > Stack | Node ESM | package.json | ok";

function factsRun(text, files = { "package.json": "{}\n" }) {
  const root = project({}, { ...files, [SHEET_FILE]: text });
  try {
    return engine("plan", path.join(root, SHEET_FILE));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("plan, sheet check: a well-formed sheet whose sources exist exits 0 and a missing answer is allowed", () => {
  assert.equal(factsRun(sheet(GOOD, "- Q1 | project-brief.md > Out of scope | what it will not do | README.md |"), { "package.json": "{}\n", "README.md": "#\n" }).status, 0);
});

test("plan, sheet check: a source that does not exist exits 1 and names the line and the path", () => {
  const run = factsRun(sheet(GOOD, "- D2 | testing.md > Run | pnpm test | scripts/absent.js | ok"));
  assert.equal(run.status, 1);
  assert.match(run.stdout, /facts\.md:9 D2.*scripts\/absent\.js/u);
  assert.doesNotMatch(run.stdout, /R1/u);
});

test("plan, sheet check: a line that breaks the grammar exits 1 and names it", () => {
  for (const bad of ["- R2 | architecture.md > Stack | only three fields", "- X9 | architecture.md > Stack | fact | package.json | ok", "- R2 | architecture.md | fact | package.json | ok"]) {
    const run = factsRun(sheet(GOOD, bad));
    assert.equal(run.status, 1, bad);
    assert.match(run.stdout, /facts\.md:9 .*shape/u, bad);
  }
});

test("plan, sheet check: a sheet with no fact line exits 1, a header bullet is no fact line", () => {
  const run = factsRun(`${SHEET_HEAD}## Read\n\nNothing to add.\n`);
  assert.equal(run.status, 1);
  assert.match(run.stdout, /no fact line/u);
  assert.equal(factsRun(sheet(GOOD)).stdout.includes("Scope"), false);
});

test("plan, sheet check: an unreadable sheet is a usage error", () => {
  const run = engine("plan", "/nonexistent/facts.md");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /facts\.md/u);
});

test("plan, sheet check: no sheet named is a usage error", () => {
  const run = engine("plan");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /usage: memory\.cjs plan/u);
});

test("plan, sheet check: a Q line may cite no source, any other line may not", () => {
  assert.equal(factsRun(sheet(GOOD, "- Q1 | project-brief.md > Out of scope | what it will not do | | ")).status, 0);
  assert.equal(factsRun(sheet(GOOD, "- R2 | project-brief.md > Purpose | a fact | | ")).status, 1);
});

// The template says a Q may cite none, and a model writes that word.
test("plan, sheet check: a Q line may cite the word none, any other line citing it is a missing source", () => {
  assert.equal(factsRun(sheet(GOOD, "- Q1 | project-brief.md > Users | who reads it | none |")).status, 0);
  const other = factsRun(sheet(GOOD, "- R2 | project-brief.md > Purpose | a fact | none |"));
  assert.equal(other.status, 1);
  assert.match(other.stdout, /R2 source not found: none/u);
});

// Nothing reads a convention set aside for a rule, so the sheet has no block for one.
test("plan, sheet check: a T line is no fact id, and every line names a memory file", () => {
  const ruled = factsRun(sheet(GOOD, "- T1 | testing.md > Run | wrap every adapter call | package.json |"));
  assert.equal(ruled.status, 1);
  assert.match(ruled.stdout, /id "T1" is not R, D or Q/u);
  assert.equal(factsRun(sheet(GOOD, "- R2 | error handling | a fact | package.json |")).status, 1);
});

// A memory is mostly tables: a fact quotes a row whole, its pipes kept, read from both ends of the line.
test("plan, sheet check: a | in a fact is part of it, and a bullet of another shape inside a block is a shape problem", () => {
  assert.equal(factsRun(sheet(GOOD, "- R2 | testing.md > Run | a | b | package.json | ok")).status, 0, "a fact holding a pipe");
  for (const bad of ["* R2 | testing.md > Run | fact | package.json |", "  - R2 | testing.md > Run | fact | package.json |", "| R2 | testing.md > Run | fact | package.json |"]) {
    const run = factsRun(sheet(GOOD, bad));
    assert.equal(run.status, 1, bad);
    assert.match(run.stdout, /facts\.md:9 .*shape/u, bad);
  }
});

test("plan, sheet check: an absolute source is outside the root even when it names a file inside it", () => {
  const root = project({}, { "package.json": "{}\n" });
  write(root, SHEET_FILE, sheet(`- R1 | architecture.md > Stack | Node | ${path.join(root, "package.json")} |`));
  try {
    const run = engine("plan", path.join(root, SHEET_FILE));
    assert.equal(run.status, 1);
    assert.match(run.stdout, /outside the root/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("plan, sheet check: a backticked source counts, a source outside the root does not", () => {
  assert.equal(factsRun(sheet("- R1 | architecture.md > Stack | Node | `package.json` |")).status, 0);
  for (const outside of ["../package.json", path.join(os.tmpdir(), "x")]) {
    const run = factsRun(sheet(GOOD, `- R2 | architecture.md > Stack | Node | ${outside} |`));
    assert.equal(run.status, 1, outside);
    assert.match(run.stdout, /outside the root/u);
  }
});

test("plan, sheet check: a target carrying the bank's folder is rejected, bank-relative names only", () => {
  const run = factsRun(sheet(GOOD, "- R2 | aidd_docs/memory/testing.md > Run | a fact | package.json |"));
  assert.equal(run.status, 1);
  assert.match(run.stdout, /bank-relative/u);
});

test("plan, sheet check: any line holding a | inside a block is a fact candidate, whatever its bullet", () => {
  for (const bad of ["+ R2 | testing.md > Run | fact | package.json |", "1. R2 | testing.md > Run | fact | package.json |", "R2 | testing.md > Run | fact | package.json |"]) {
    const run = factsRun(sheet(GOOD, bad));
    assert.equal(run.status, 1, bad);
    assert.match(run.stdout, /facts\.md:9 .*shape/u, bad);
  }
});

test("plan, sheet check: an id is used once, and more than eight Q lines are listed", () => {
  const twice = factsRun(sheet(GOOD, GOOD));
  assert.equal(twice.status, 1);
  assert.match(twice.stdout, /R1.*already used/u);
  const nine = Array.from({ length: 9 }, (_, index) => `- Q${index + 1} | project-brief.md > Out of scope | question ${index} | |`);
  const many = factsRun(sheet(GOOD, ...nine));
  assert.equal(many.status, 1);
  assert.match(many.stdout, /9 Q lines, at most eight/u);
  assert.equal(factsRun(sheet(GOOD, ...nine.slice(0, 8))).status, 0);
});
