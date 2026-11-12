const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
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
