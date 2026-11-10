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
  "Memory plan",
  "",
  "Changes since the last memory update (4b9499c, 10 seconds ago): 1 commit, 8 files",
  "",
  "Will write",
  "  1. testing.md   Run, Tools",
  "",
  "Will add",
  "  2. codebase-map.md, Packages",
  "     + `tools/performance`: the Lighthouse runner",
  "",
  "Will change",
  '  3. architecture.md: "- TypeScript everywhere. `backend/`: Express on Node."',
  '     → "- TypeScript everywhere. `backend/`: Hono on Node."',
  '  4. codebase-map.md: "Three workspace packages in total."',
  '     → "Four workspace packages in total."',
  "",
  "Will delete",
  '  5. codebase-map.md: "- `legacy/` holds the old door."',
  "     why: the folder is gone",
  "",
  "Questions",
  "  Q1  Which gate runs before a push?",
  "",
  "Tools to wire",
  "  [x] claude  [ ] codex  [ ] cursor  [ ] opencode  [ ] antigravity  [ ] copilot",
  "",
  'Does this look right? Say ok, or what to change, for example "not 5" or "Q1: …".',
  "",
  `Sheet: ${SHEET}`,
  "",
].join("\n");

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
  }, REFRESH, FULL);
});

test("plan: a setup has no Since line, an empty section is left out, and no question means the example names only a number", () => {
  const setup = ["# Facts: setup", "", "- Capabilities: C1 api", "", "## Read", "", "- R1 | testing.md > Run | `pnpm test` runs the unit layer | package.json |", ""].join("\n");
  withProject((root) => {
    const out = engine(root, "plan", SHEET).stdout;
    assert.doesNotMatch(out, /Changes since/u);
    assert.doesNotMatch(out, /Will add|Will change|Will delete|Questions|none/u);
    assert.match(out, /^ {2}\[ \] claude {2}\[ \] codex/mu, "no tool given ticks none");
    assert.match(out, /^Does this look right\? Say ok, or what to change, for example "not 1"\.$/mu);
  }, setup, {});
});

// An always file is written whatever the sheet holds, so the plan names it, with no number to decline.
test("plan: an absent always file is listed under Will write with no number, an accepted name counts as present", () => {
  withProject((root) => {
    const out = engine(root, "plan", SHEET).stdout;
    for (const name of ["project-brief.md", "vcs.md"]) assert.match(out, new RegExp(`^ {2}${name.replace(".", "\\.")} {3}from its template, always written$`, "mu"), name);
    assert.doesNotMatch(out, /^ {2}(?:architecture|codebase-map|testing)\.md {3}from its template/mu, "a present file or a sheet item is listed again");
    assert.doesNotMatch(out, /ecosystem\.md/u, "an accepted name does not count as the always file");
    assert.deepEqual([...out.matchAll(/^ {2}(\d+)\. /gmu)].map((match) => match[1]), ["1", "2", "3", "4", "5"], "an always file took a number");
  }, REFRESH, { ...BANK, "coding-assertions.md": "# Coding Assertions\n", "integration.md": "# Integration\n" });
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
    const plan = engine(root, "plan", SHEET).stdout;
    const items = [...plan.matchAll(/^ {2}(\d+)\. /gmu)].map((match) => match[1]);
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
