// The plan the person reads and the answer that marks the sheet come from one numbering in the
// engine, so "not 3" can only ever reach the lines item 3 showed.
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ENGINE = path.resolve(__dirname, "../../plugins/aidd-context/hooks/memory.cjs");
const SHEET = "aidd_docs/tasks/2026_01/2026_01_02_memory-refresh/facts.md";

const BANK = {
  "architecture.md": "# Architecture\n\n## Stack\n\n- TypeScript everywhere. `backend/`: Express on Node.\n",
  "codebase-map.md": "# Codebase Map\n\n## Packages\n\n- Three workspace packages in total.\n\n## Entry points\n\n- The server and cron doors.\n- `legacy/` holds the old door.\n",
};

// Every always file present but testing.md, which the sheet writes.
const FULL = { ...BANK, ...Object.fromEntries(["project-brief", "coding-assertions", "vcs", "ecosystem"].map((name) => [`${name}.md`, `# ${name}\n`])) };

const REFRESH = [
  "# Facts: refresh",
  "",
  "- Capabilities: C1 api",
  "- Since 4b9499c (docs: write the project memory), 10 seconds ago: 1 commit, 8 files changed",
  "",
  "## Read",
  "",
  "- R1 | codebase-map.md > Packages | `tools/performance`: the Lighthouse runner | package.json |",
  "- R2 | testing.md > Run | `pnpm test` runs the unit layer | package.json |",
  "- R3 | testing.md > Tools | vitest | package.json |",
  "",
  "## Inferred",
  "",
  '- D1 | architecture.md > Stack | replace "- TypeScript everywhere. `backend/`: Express on Node." with "- TypeScript everywhere. `backend/`: Hono on Node." | package.json |',
  '- D2 | codebase-map.md > Packages | replace "Three workspace packages in total." with "Four workspace packages in total." | package.json |',
  '- D3 | codebase-map.md > Entry points | remove "- `legacy/` holds the old door.": the folder is gone | package.json |',
  "",
  "## Unknown",
  "",
  "- Q1 | testing.md > Run | Which gate runs before a push? | none |",
  "",
].join("\n");

const PLAN = [
  "Memory plan: 5 changes since 4b9499c (1 commit, 8 files)",
  "  1 write · 1 add · 2 change · 1 remove",
  "",
  "Lines that will disappear",
  '  3. architecture.md: "- TypeScript everywhere. `backend/`: Express on Node."',
  '  4. codebase-map.md: "Three workspace packages in total."',
  '  5. codebase-map.md: "- `legacy/` holds the old door."',
  "",
  "Questions",
  "  Q1  Which gate runs before a push?",
  "",
  "Tools to wire",
  "  [x] claude  [ ] codex  [ ] cursor  [ ] opencode  [ ] antigravity  [ ] copilot",
  "",
  `Details: ${SHEET.replace("facts.md", "plan.md")}`,
  "",
  'Say ok, or "not <n>" or "not <n>-<m>" with the numbers in the details, or "Q1: …".',
  "",
].join("\n");

const detailOf = (root) => fs.readFileSync(path.join(root, SHEET.replace("facts.md", "plan.md")), "utf8");

function project(sheet = REFRESH, bank = BANK) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "memory-plan-"));
  const write = (name, text) => {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  };
  for (const [name, text] of Object.entries(bank)) write(`aidd_docs/memory/${name}`, text);
  write("package.json", "{}\n");
  write(SHEET, sheet);
  return root;
}

function engine(root, ...args) {
  return spawnSync("node", [ENGINE, ...args], { cwd: root, encoding: "utf8" });
}

const sheetOf = (root) => fs.readFileSync(path.join(root, SHEET), "utf8");
const answerOf = (text, id) => text.split("\n").find((line) => line.startsWith(`- ${id} |`)).split("|")[4]?.trim() ?? "";

function withProject(fn, sheet, bank) {
  const root = project(sheet, bank);
  try {
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("plan: prints the sheet as the person reads it, in fixed order and numbering, the ticked tools given", () => {
  withProject((root) => {
    const run = engine(root, "plan", SHEET, "--tools", "claude");
    assert.equal(run.stderr, "");
    assert.equal(run.status, 0);
    assert.equal(run.stdout, PLAN);
    const detail = detailOf(root);
    for (const line of [
      "  1. write   testing.md (new): Run, Tools",
      "  2. add     codebase-map.md, Packages: `tools/performance`: the Lighthouse runner",
      '  3. change  architecture.md: "- TypeScript everywhere. `backend/`: Express on Node."',
      '  5. remove  codebase-map.md: "- `legacy/` holds the old door."',
    ]) assert.ok(detail.split("\n").includes(line), line);
    assert.match(detail, /^ {5}→ "- TypeScript everywhere\. `backend\/`: Hono on Node\."$/mu, "the detail drops the new text");
    assert.match(detail, /^ {5}at aidd_docs\/memory\/architecture\.md:5$/mu, "the detail has no link to the line it changes");
    assert.match(detail, /^ {5}at aidd_docs\/memory\/codebase-map\.md:10$/mu);
    assert.match(detail, /^ {5}why: the folder is gone$/mu);
  }, REFRESH, FULL);
});

// A short label per item: the chat shows what changes, the detail file shows it whole.
test("plan: a long quoted line is cut in the summary and kept whole in the detail", () => {
  const long = `- ${"word ".repeat(30).trim()}.`;
  const sheet = REFRESH.replace('remove "- `legacy/` holds the old door."', `remove "${long}"`);
  withProject((root) => {
    const run = engine(root, "plan", SHEET);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const line = detailOf(root).split("\n").find((one) => one.startsWith("  5. remove"));
    assert.ok(line.length <= 100 && line.endsWith('…"'), line);
    assert.ok(detailOf(root).includes(`"${long}"`), "the detail cuts the line");
  }, sheet, { ...FULL, "codebase-map.md": FULL["codebase-map.md"].replace("- `legacy/` holds the old door.", long) });
});

test("plan: a move reads as from → to, and two-digit numbers keep the columns aligned", () => {
  const moves = [...Array(10)].map((_, index) => `- D${index + 10} | codebase-map.md > Entry points | move aidd_docs/memory/k${index} to aidd_docs/memory/internal/k${index} | package.json |`);
  const sheet = REFRESH.replace("\n## Unknown", `${moves.join("\n")}\n\n## Unknown`);
  withProject((root) => {
    engine(root, "plan", SHEET);
    const out = detailOf(root);
    assert.match(out, /^ {2}5\. {2}move {4}aidd_docs\/memory\/k0 → aidd_docs\/memory\/internal\/k0$/mu, out);
    assert.match(out, /^ {2}14\. move {4}aidd_docs\/memory\/k9 → /mu);
  }, sheet, FULL);
});

test("answer: a range declines every item in it", () => {
  withProject((root) => {
    assert.equal(engine(root, "answer", SHEET, "not 2-4").status, 0);
    const text = sheetOf(root);
    assert.deepEqual(["R2", "R1", "D1", "D2", "D3"].map((id) => answerOf(text, id)), ["yes", "no", "no", "no", "yes"]);
    assert.equal(engine(root, "answer", SHEET, "not 4-9").status, 1, "a range past the last item");
  }, REFRESH, FULL);
});

test("plan: a setup has no Since line, an empty section is left out, and no question means the example names only a number", () => {
  const setup = ["# Facts: setup", "", "- Capabilities: C1 api", "", "## Read", "", "- R1 | testing.md > Run | `pnpm test` runs the unit layer | package.json |", ""].join("\n");
  withProject((root) => {
    const out = engine(root, "plan", SHEET).stdout;
    assert.doesNotMatch(out, /Changes since/u);
    assert.doesNotMatch(out, /Will add|Will change|Will delete|Questions|none/u);
    assert.match(out, /^ {2}\[ \] claude {2}\[ \] codex/mu, "no tool given ticks none");
    assert.match(out, /^Say ok, or "not <n>" or "not <n>-<m>" with the numbers in the details\.$/mu);
    assert.match(out, /^Memory plan: 1 change$/mu);
    assert.match(detailOf(root), /^ {2}1\. write {3}testing\.md \(new\): Run$/mu);
  }, setup, {});
});

// An always file is written whatever the sheet holds, so the plan names it, with no number to decline.
test("plan: an absent always file is listed under Will write with no number, an accepted name counts as present", () => {
  withProject((root) => {
    assert.match(engine(root, "plan", SHEET).stdout, /^ {2}1 write · 1 add · 2 change · 1 remove · 2 from templates$/mu);
    const out = detailOf(root);
    for (const name of ["project-brief.md", "vcs.md"]) assert.match(out, new RegExp(`^ {5}write {3}${name.replace(".", "\\.")} \\(new\\): from its template, always written$`, "mu"), name);
    assert.doesNotMatch(out, /^ {5}write {3}(?:architecture|codebase-map|testing)\.md \(new\): from its template/mu, "a present file or a sheet item is listed again");
    assert.doesNotMatch(out, /ecosystem\.md/u, "an accepted name does not count as the always file");
    assert.deepEqual([...out.matchAll(/^ {2}(\d+)\. /gmu)].map((match) => match[1]), ["1", "2", "3", "4", "5"], "an always file took a number");
  }, REFRESH, { ...BANK, "coding-assertions.md": "# Coding Assertions\n", "integration.md": "# Integration\n" });
});

// A refresh with nothing to remember leaves a sheet with no fact line: that is a current bank, not a broken sheet.
test("plan: a sheet with no fact line is a bank that is current, exit 0, the tools still listed", () => {
  const empty = ["# Facts: refresh", "", "## Read", "", "## Inferred", "", "## Unknown", ""].join("\n");
  withProject((root) => {
    const run = engine(root, "plan", SHEET, "--tools", "claude");
    assert.equal(run.stderr, "");
    assert.equal(run.status, 0, run.stdout);
    assert.match(run.stdout, /^Memory plan: 0 changes, the bank is current$/mu);
    assert.match(run.stdout, /^ {2}\[x\] claude {2}\[ \] codex/mu);
    assert.doesNotMatch(run.stdout, /Say ok/u);
  }, empty, { ...FULL, "testing.md": "# Testing\n" });
  withProject((root) => assert.match(engine(root, "plan", SHEET).stdout, /^ {2}1 write · 1 add · 2 change · 1 remove/mu), REFRESH, FULL);
  withProject((root) => assert.match(engine(root, "plan", SHEET).stdout, /^Memory plan: 0 changes$/mu), empty.replace("## Unknown\n", "## Unknown\n\n- Q1 | testing.md > Run | Which gate runs before a push? | none |\n"), FULL);
});

test("plan: a sheet that breaks the grammar or quotes no whole line of the bank prints the problems and no plan", () => {
  const fragment = REFRESH.replace('replace "- TypeScript everywhere. `backend/`: Express on Node."', 'replace "`backend/`: Express on Node."');
  withProject((root) => {
    const run = engine(root, "plan", SHEET);
    assert.equal(run.status, 1);
    assert.doesNotMatch(run.stdout, /Memory plan/u);
    assert.match(run.stdout, /D1 quotes no whole line of architecture\.md: quote "- TypeScript everywhere\. `backend\/`: Express on Node\." whole/u);
  }, fragment);
  withProject((root) => assert.equal(engine(root, "plan", SHEET).status, 1), REFRESH.replace("- R3 | testing.md > Tools | vitest | package.json |", "- R3 | testing.md > Tools | vitest | missing.json |"));
});

test("answer: not N marks that item's lines no and the others yes, prints what it marked, and a second run changes nothing", () => {
  withProject((root) => {
    const run = engine(root, "answer", SHEET, "not 3");
    assert.equal(run.status, 0, run.stderr);
    const text = sheetOf(root);
    assert.equal(answerOf(text, "D1"), "no");
    for (const id of ["R1", "R2", "R3", "D2", "D3"]) assert.equal(answerOf(text, id), "yes", id);
    assert.equal(answerOf(text, "Q1"), "", "a question is the model's to answer");
    assert.match(run.stdout, /^3 no: architecture\.md "- TypeScript everywhere\./mu);
    assert.match(run.stdout, /^5 yes: codebase-map\.md "- `legacy\/` holds the old door\."$/mu);
    assert.equal(engine(root, "answer", SHEET, "not 3").status, 0);
    assert.equal(sheetOf(root), text, "a second run changed the sheet");
  });
});

test("answer: ok with tools and a question marks every item yes and leaves the rest to the model, by name", () => {
  withProject((root) => {
    const run = engine(root, "answer", SHEET, "ok, tools: claude, codex. Q1: the e2e gate");
    assert.equal(run.status, 0, run.stderr);
    for (const id of ["R1", "R2", "R3", "D1", "D2", "D3"]) assert.equal(answerOf(sheetOf(root), id), "yes", id);
    assert.match(run.stdout, /^left to you: tools: claude, codex$/mu);
    assert.match(run.stdout, /^left to you: Q1: the e2e gate$/mu);
  });
});

test("answer: no marks every item no; all but N is not N", () => {
  withProject((root) => {
    assert.equal(engine(root, "answer", SHEET, "no").status, 0);
    for (const id of ["R1", "R2", "R3", "D1", "D2", "D3"]) assert.equal(answerOf(sheetOf(root), id), "no", id);
    assert.equal(engine(root, "answer", SHEET, "all but 2, 5").status, 0);
    const text = sheetOf(root);
    assert.deepEqual(["R1", "D3", "D1"].map((id) => answerOf(text, id)), ["no", "no", "yes"]);
  });
});

test("answer: any other reply, or a number no item has, exits 1 and leaves the sheet as it was", () => {
  withProject((root) => {
    for (const reply of ["change 2 to five packages", "not 9", "", "maybe"]) {
      const run = engine(root, "answer", SHEET, reply);
      assert.equal(run.status, 1, reply);
      assert.equal(sheetOf(root), REFRESH, reply);
    }
  });
});

test("answer: a line with no answer field gains one, and nothing under the bank is written", () => {
  const bare = REFRESH.replace("| package.json |\n- R2", "| package.json\n- R2");
  withProject((root) => {
    const bank = Object.fromEntries(Object.keys(BANK).map((name) => [name, fs.readFileSync(path.join(root, "aidd_docs/memory", name), "utf8")]));
    assert.equal(engine(root, "answer", SHEET, "ok").status, 0);
    assert.equal(answerOf(sheetOf(root), "R1"), "yes");
    for (const [name, text] of Object.entries(bank)) assert.equal(fs.readFileSync(path.join(root, "aidd_docs/memory", name), "utf8"), text, name);
  }, bare);
});

test("plan and answer share one numbering: not N reaches exactly the sheet lines item N shows", () => {
  withProject((root) => {
    engine(root, "plan", SHEET);
    const items = [...detailOf(root).matchAll(/^ {2}(\d+)\. /gmu)].map((match) => match[1]);
    assert.deepEqual(items, ["1", "2", "3", "4", "5"]);
    const shownBy = { 1: ["R2", "R3"], 2: ["R1"], 3: ["D1"], 4: ["D2"], 5: ["D3"] };
    for (const n of items) {
      fs.writeFileSync(path.join(root, SHEET), REFRESH);
      engine(root, "answer", SHEET, `not ${n}`);
      const text = sheetOf(root);
      const declined = ["R1", "R2", "R3", "D1", "D2", "D3"].filter((id) => answerOf(text, id) === "no");
      assert.deepEqual(declined.sort(), shownBy[n].sort(), `item ${n}`);
    }
  }, REFRESH, FULL);
});

// report: the closing message, from the same numbering, with the lines the write lost computed by
// the engine itself, so a model that skips a step still shows the person what left the memory.

/** Every file under `root`, `.git` included, as name and content: what report must leave as it found it. */
function treeState(root, relative = "") {
  return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap((entry) => {
    const next = path.join(relative, entry.name);
    return entry.isDirectory() ? treeState(root, next) : [`${next} ${fs.readFileSync(path.join(root, next), "base64")}`];
  });
}

// The write a model makes for "not 3": item 3 (D1) left as it is, the rest applied.
const WRITTEN = {
  "testing.md": "# Testing\n\n## Run\n\n- `pnpm test` runs the unit layer\n\n## Tools\n\n- vitest\n",
  "codebase-map.md": "# Codebase Map\n\n## Packages\n\n- Four workspace packages in total.\n- `tools/performance`: the Lighthouse runner\n\n## Entry points\n\n- The server and cron doors.\n",
};

/** The FULL bank and the sheet, `plan` run on them (the snapshot), answered by `reply` when given, then `bank` written over the bank and the claude block synced. */
function written(fn, { reply = "not 3", bank = WRITTEN, planned = true, sheet = REFRESH } = {}) {
  withProject((root) => {
    fs.writeFileSync(path.join(root, "CLAUDE.md"), "# Project\n");
    if (planned) assert.equal(engine(root, "plan", SHEET).status, 0);
    if (reply !== null) assert.equal(engine(root, "answer", SHEET, reply).status, 0);
    for (const [name, text] of Object.entries(bank)) {
      fs.mkdirSync(path.dirname(path.join(root, "aidd_docs/memory", name)), { recursive: true });
      fs.writeFileSync(path.join(root, "aidd_docs/memory", name), text);
    }
    assert.equal(engine(root, "sync", "--add", "claude").status, 0);
    return fn(root);
  }, sheet, FULL);
}

const REPORT = [
  "Memory ready",
  "",
  "Written",
  "  aidd_docs/memory: codebase-map.md, testing.md",
  "  CLAUDE.md: memory block",
  "",
  "Changed",
  "  1. testing.md   Run, Tools",
  "  2. codebase-map.md, Packages",
  "     + `tools/performance`: the Lighthouse runner",
  '  4. codebase-map.md: "Three workspace packages in total."',
  '     → "Four workspace packages in total."',
  '  5. codebase-map.md: "- `legacy/` holds the old door."',
  "     why: the folder is gone",
  "",
  "Left out",
  "  3. architecture.md: you declined",
  "  Q1  Which gate runs before a push?: unanswered. Tell me the answer any time and I add it to testing.md.",
  "",
  "Heads-up",
  "  Every session loads WORDS words from 7 files.",
  "",
].join("\n");

const words = (text) => text.replace(/loads \d+ words/u, "loads WORDS words");

test("report: prints the closing message with the plan's numbers, what the write touched and the session load, and writes nothing", () => {
  written((root) => {
    const before = treeState(root);
    const run = engine(root, "report", SHEET);
    assert.equal(run.stderr, "");
    assert.equal(run.status, 0);
    assert.equal(words(run.stdout), REPORT);
    assert.deepEqual(treeState(root), before, "report wrote to the tree");
  });
});

test("report: a line the write lost with no approved item heads the message, under a title that says so", () => {
  const lossy = { ...WRITTEN, "codebase-map.md": WRITTEN["codebase-map.md"].replace("\n## Entry points\n\n- The server and cron doors.\n", "") };
  written((root) => {
    const out = engine(root, "report", SHEET).stdout;
    assert.match(out, /^Memory written, 1 line lost\n\nLines lost\n {2}No item you approved removes these lines\. Restore them before you commit\.\n {2}codebase-map\.md: - The server and cron doors\.\n\nWritten\n/u, "a heading is listed as a lost fact");
    assert.doesNotMatch(out, /Memory ready/u);
  }, { bank: lossy });
});

// Limit: a replacement that changes only a short word (three to four) keeps every fact word and is not listed.
test("report: a sheet never answered applies no approval, so a removed line is lost and each item has no answer recorded", () => {
  written((root) => {
    const out = engine(root, "report", SHEET).stdout;
    assert.match(out, /^Memory written, 1 line lost$/mu);
    assert.match(out, /^ {2}codebase-map\.md: - `legacy\/` holds the old door\.$/mu);
    assert.doesNotMatch(out, /^Changed$/mu, "an unanswered item is reported applied");
    for (const n of ["1", "2", "3", "4", "5"]) assert.match(out, new RegExp(`^ {2}${n}\\. \\S+\\.md: no answer recorded$`, "mu"), n);
  }, { reply: null });
});

test("report: with no git the plan's snapshot is the baseline, and with no snapshot nothing is called ready", () => {
  written((root) => {
    const out = engine(root, "report", SHEET).stdout;
    assert.match(out, /^Memory ready\n/u);
    assert.match(out, /^ {2}aidd_docs\/memory: codebase-map\.md, testing\.md$/mu);
    const missing = engine(root, "report", "aidd_docs/tasks/absent.md");
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /absent\.md not read/u);
  });
  written((root) => assert.match(engine(root, "report", SHEET).stdout, /^Memory written, lost lines not checked\n\nLines lost\n {2}not checked: no plan snapshot/u), { planned: false });
});

// The plan numbered testing.md as a new file; it exists on disk by the report, and the number must not move.
test("report: items keep the plan's numbers once the bank holds the files, and an item the write did not match the answer is said so", () => {
  written((root) => {
    const out = engine(root, "report", SHEET).stdout;
    assert.match(out, /^ {2}1\. testing\.md: you declined, but the bank shows it applied$/mu, "the number moved, or a declined file written is a silent Written");
    assert.doesNotMatch(out, /^ {2}1\. testing\.md {3}Run, Tools$/mu);
  }, { reply: "not 1" });
  const unapplied = { ...WRITTEN, "codebase-map.md": WRITTEN["codebase-map.md"].replace("Four workspace", "Three workspace") };
  written((root) => {
    const out = engine(root, "report", SHEET).stdout;
    assert.match(out, /^ {2}4\. codebase-map\.md: approved, but the bank does not show it applied$/mu);
    assert.doesNotMatch(out, /^ {2}4\. codebase-map\.md: "Three workspace/mu, "an unapplied replace is listed as changed");
  }, { reply: "ok", bank: unapplied });
});

test("report: a folder of more than three written files reads as one entry", () => {
  const moved = Object.fromEntries([1, 2, 3, 4].map((index) => [`internal/kpi/${index}-indicator.md`, `# Indicator ${index}\n`]));
  moved["internal/kpi/probes/github.md"] = "# Probe\n";
  written((root) => {
    assert.match(engine(root, "report", SHEET).stdout, /^ {2}aidd_docs\/memory: codebase-map\.md, internal\/kpi\/ \(4 files\), internal\/kpi\/probes\/github\.md, testing\.md$/mu);
  }, { bank: { ...WRITTEN, ...moved } });
});

test("plan and answer: a table row quoted whole, pipes and all, is an item the reply marks", () => {
  const table = "# Testing\n\n## Run\n\n| Command | Runs |\n| --- | --- |\n| `make fuzz` | the fuzzer |\n";
  const sheet = REFRESH.replace('- D3 | codebase-map.md > Entry points | remove "- `legacy/` holds the old door.": the folder is gone | package.json |', '- D3 | testing.md > Run | remove "| `make fuzz` | the fuzzer |": the target is gone | package.json |');
  withProject((root) => {
    const run = engine(root, "plan", SHEET);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(detailOf(root), /remove {2}testing\.md: "\| `make fuzz` \| the fuzzer \|"/u);
    assert.equal(engine(root, "answer", SHEET, "ok").status, 0);
    assert.match(sheetOf(root), /^- D3 \| testing\.md > Run \| remove "\| `make fuzz` \| the fuzzer \|": the target is gone \| package\.json \| yes$/mu);
  }, sheet, { ...FULL, "testing.md": table });
});
