const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

// In process: the hook is the only caller, and memory-hook.test.js drives the shipped script.
const HOOK = path.resolve(__dirname, "../../plugins/aidd-context/hooks/memory.cjs");
const { sync } = require(HOOK);
const HOOK_ENV = { ...process.env };

const OPEN = "<!-- aidd_project_memory:start -->";
const CLOSE = "<!-- aidd_project_memory:end -->";

/** A throwaway project with a memory bank and a context file, synced `runs` times. */
function run({ context, contextAt = "CLAUDE.md", bank = ["architecture.md"], onDemand = [], runs = 1 }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "memory-sync-"));
  try {
    fs.mkdirSync(path.join(root, "aidd_docs/memory"), { recursive: true });
    for (const file of bank) fs.writeFileSync(path.join(root, "aidd_docs/memory", file), "# x\n");
    for (const file of onDemand) {
      const full = path.join(root, "aidd_docs/memory", file);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, "# x\n");
    }
    const target = path.join(root, contextAt);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, context);
    const read = () => fs.readFileSync(target, "utf8");
    const notSynced = sync(root);
    const content = read();
    return { notSynced, content, contentAfterRerun: runs > 1 ? (sync(root), read()) : content };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("a legacy block is migrated to the comment markers and filled", () => {
  const content = run({
    context: "# P\n\n<aidd_project_memory>\n@aidd_docs/memory/old.md\n</aidd_project_memory>\n",
  }).content;

  assert.equal(content.includes("<aidd_project_memory>"), false);
  assert.equal(content, `# P\n\n${OPEN}\n\n@aidd_docs/memory/architecture.md\n\n${CLOSE}\n`);
});

test("a legacy pair quoted in prose is left alone and the real block still migrates", () => {
  const quote = "Old shape: `<aidd_project_memory>` ... `</aidd_project_memory>`.";
  const content = run({
    context: `${quote}\n\n<aidd_project_memory>\n</aidd_project_memory>\n`,
  }).content;

  assert.equal(content.split("\n")[0], quote);
  assert.equal(content.split("\n")[2], OPEN);
});

test("a legacy pair inside a code fence is not the block that gets rewritten", () => {
  const content = run({
    context: [
      "```markdown",
      "<aidd_project_memory>",
      "</aidd_project_memory>",
      "```",
      "",
      "<aidd_project_memory>",
      "</aidd_project_memory>",
      "",
    ].join("\n"),
  }).content;

  const lines = content.split("\n");
  assert.equal(lines[1], "<aidd_project_memory>");
  assert.equal(lines[5], OPEN);
});

test("the imports keep a blank line on each side, so nothing hides them", () => {
  const content = run({
    context: `${OPEN}\n${CLOSE}\n`,
    bank: ["architecture.md", "vcs.md"],
  }).content;

  assert.equal(
    content,
    `${OPEN}\n\n@aidd_docs/memory/architecture.md\n@aidd_docs/memory/vcs.md\n\n${CLOSE}\n`,
  );
});

test("filling is idempotent", () => {
  const result = run({ context: `${OPEN}\n${CLOSE}\n`, runs: 2 });

  assert.equal(result.contentAfterRerun, result.content);
  assert.match(result.content, /@aidd_docs\/memory\/architecture\.md/u);
});

test("the on-demand tier is listed without an import prefix", () => {
  const content = run({
    context: `${OPEN}\n${CLOSE}\n`,
    onDemand: ["internal/decision.md"],
  }).content;

  assert.match(content, /^- aidd_docs\/memory\/internal\/decision\.md$/mu);
});

test("a file holding one marker without its pair reports instead of skipping silently", () => {
  const result = run({ context: `# P\n\n<aidd_project_memory>\n${CLOSE}\n` });

  assert.deepEqual(result.notSynced, ["CLAUDE.md has an unpaired project memory marker, not synced"]);
});

test("a new-marker pair quoted in prose above the block does not hijack the splice", () => {
  const quote = `Upgrade note: the block now uses \`${OPEN}\` and \`${CLOSE}\`.`;
  const result = run({ context: `${quote}\n\n${OPEN}\n${CLOSE}\n` });

  assert.equal(result.content.split("\n")[0], quote);
  assert.equal(
    result.content,
    `${quote}\n\n${OPEN}\n\n@aidd_docs/memory/architecture.md\n\n${CLOSE}\n`,
  );
});

test("a nested fence does not close the example that documents the old shape", () => {
  const content = run({
    context: [
      "````markdown",
      "```",
      "<aidd_project_memory>",
      "</aidd_project_memory>",
      "```",
      "````",
      "",
      "<aidd_project_memory>",
      "</aidd_project_memory>",
      "",
    ].join("\n"),
  }).content;

  const lines = content.split("\n");
  assert.equal(lines[2], "<aidd_project_memory>", "the documented example must stay as written");
  assert.equal(lines[7], OPEN, "the real block must be the one migrated");
  assert.match(content, /@aidd_docs\/memory\/architecture\.md/u);
});

// The @ import form is Claude-only. AGENTS.md is read by codex, cursor and
// opencode, none of which resolve it, so an @ line there was inert text.
test("AGENTS.md gets markdown links, resolvable from the repository root", () => {
  const content = run({
    context: `${OPEN}\n${CLOSE}\n`,
    contextAt: "AGENTS.md",
  }).content;

  assert.match(content, /^\[aidd_docs\/memory\/architecture\.md\]\(aidd_docs\/memory\/architecture\.md\)$/mu);
  assert.doesNotMatch(content, /\(\.\.\//u);
});

test("the block lists every aidd_docs/ folder other than the bank, read on demand, after the bank's own files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "memory-sync-"));
  try {
    for (const dir of ["memory/internal", "ui", "pm", "tasks"]) fs.mkdirSync(path.join(root, "aidd_docs", dir), { recursive: true });
    fs.writeFileSync(path.join(root, "aidd_docs/memory/architecture.md"), "# x\n");
    fs.writeFileSync(path.join(root, "aidd_docs/memory/internal/d.md"), "# x\n");
    fs.writeFileSync(path.join(root, "aidd_docs/notes.md"), "# a file, not a folder\n");
    fs.writeFileSync(path.join(root, "CLAUDE.md"), `${OPEN}\n${CLOSE}\n`);
    assert.deepEqual(sync(root), []);
    assert.equal(
      fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8"),
      [
        OPEN,
        "",
        "@aidd_docs/memory/architecture.md",
        "",
        "<!-- read on demand, not auto-loaded -->",
        "- aidd_docs/memory/internal/d.md",
        "",
        "<!-- folders other plugins own, read on demand -->",
        "- aidd_docs/pm/",
        "- aidd_docs/tasks/",
        "- aidd_docs/ui/",
        "",
        CLOSE,
        "",
      ].join("\n")
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("sync runs no child process, so it stages nothing in git", () => {
  const source = fs.readFileSync(HOOK, "utf8");
  assert.doesNotMatch(source, /child_process|execSync|spawn|git add/u);
});

// A throwaway project with a bank, `files` written as given and `links` as symlinks to a sibling.
function sandbox(files, links = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "memory-sync-box-"));
  fs.mkdirSync(path.join(root, "aidd_docs/memory"), { recursive: true });
  fs.writeFileSync(path.join(root, "aidd_docs/memory/architecture.md"), "# x\n");
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  }
  for (const [name, target] of Object.entries(links)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.symlinkSync(target, path.join(root, name));
  }
  return root;
}

const read = (root, name) => fs.readFileSync(path.join(root, name), "utf8");
const EMPTY = `# P\n\n${OPEN}\n${CLOSE}\n`;
const FILLED_AT = `${OPEN}\n\n@aidd_docs/memory/architecture.md\n\n${CLOSE}`;

test("sync leaves the memory README as it is: it no longer keeps a list of files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "memory-sync-"));
  try {
    const memory = path.join(root, "aidd_docs/memory");
    fs.mkdirSync(memory, { recursive: true });
    fs.writeFileSync(path.join(memory, "architecture.md"), "# x\n");
    const readme = "# memory/\n\n<!-- files:start -->\n<!-- files:end -->\n";
    fs.writeFileSync(path.join(memory, "README.md"), readme);
    fs.writeFileSync(path.join(root, "CLAUDE.md"), `${OPEN}\n${CLOSE}\n`);
    assert.deepEqual(sync(root), []);
    assert.equal(fs.readFileSync(path.join(memory, "README.md"), "utf8"), readme);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

const TEAM = "# Team\n\n```md\n@README.md\n```\n\n- Answer in French.\n";
const FILLED_LINK = `${OPEN}\n\n[aidd_docs/memory/architecture.md](aidd_docs/memory/architecture.md)\n\n${CLOSE}`;

test("a session start, or any sync, never adds a block to a file holding none, and says nothing of it", () => {
  const root = sandbox({ "CLAUDE.md": TEAM, "AGENTS.md": TEAM });
  try {
    const payload = JSON.stringify({ hook_event_name: "SessionStart", session_id: "sync-no-block", cwd: root, source: "startup" });
    const hook = spawnSync(process.execPath, [HOOK, "load"], { cwd: root, env: HOOK_ENV, input: payload, encoding: "utf8" });
    assert.equal(hook.status, 0, hook.stderr);
    assert.equal(read(root, "CLAUDE.md"), TEAM, "the session start added a block");
    assert.deepEqual(sync(root), [], "a sync spoke about a file it never adds to");
    assert.equal(read(root, "CLAUDE.md"), TEAM, "a sync added a block");
    assert.equal(read(root, "AGENTS.md"), TEAM);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a link to nothing and a copilot file linked to AGENTS.md are still never written", () => {
  const root = sandbox({ "AGENTS.md": EMPTY }, { "CLAUDE.md": "gone.md", [".github/copilot-instructions.md"]: "../AGENTS.md" });
  try {
    assert.deepEqual(sync(root), []);
    assert.equal(fs.existsSync(path.join(root, "gone.md")), false, "a dangling link was followed");
    assert.equal(read(root, "AGENTS.md"), `# P\n\n${FILLED_LINK}\n`, "AGENTS.md is filled once, with no pointer");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a target that cannot be written is named, and the others still sync", (t) => {
  if (process.getuid?.() === 0) return t.skip("root writes through a read-only file");
  const root = sandbox({ "CLAUDE.md": EMPTY, "AGENTS.md": EMPTY });
  try {
    fs.chmodSync(path.join(root, "CLAUDE.md"), 0o444);
    // Windows refuses a write to a read-only file with EPERM, POSIX with EACCES.
    const code = process.platform === "win32" ? "EPERM" : "EACCES";
    assert.deepEqual(sync(root), [`CLAUDE.md not written (${code}), skipped`]);
    assert.match(read(root, "AGENTS.md"), /\[aidd_docs\/memory\/architecture\.md\]\(aidd_docs\/memory\/architecture\.md\)/u);
    assert.equal(read(root, "CLAUDE.md"), EMPTY);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a line the generator would not write in the block leaves the file as it is, and is reported", () => {
  const team = `${OPEN}\n\n@aidd_docs/memory/architecture.md\n@docs/team-glossary.md\n\n${CLOSE}\n`;
  const root = sandbox({ "CLAUDE.md": team });
  try {
    assert.deepEqual(sync(root), ['CLAUDE.md holds a line the memory block would not write ("@docs/team-glossary.md"), not synced']);
    assert.equal(read(root, "CLAUDE.md"), team);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// A line shaped like a generated one is a team's unless it is exactly one the generator writes now,
// or a bare path to something that no longer exists.
test("a team line shaped like a generated one is held and reported, never erased", () => {
  const lines = [
    "- aidd_docs/ui/ is owned by the design team, ask Ana before editing",
    "@aidd_docs/memory/architecture.md is the entry point, read it first",
    "@aidd_docs/memory/internal/decisions.md",
    "[Decisions](aidd_docs/memory/internal/decisions.md) are read first",
  ];
  for (const line of lines) {
    const team = `${OPEN}\n\n@aidd_docs/memory/architecture.md\n${line}\n\n${CLOSE}\n`;
    const root = sandbox({ "CLAUDE.md": team, "aidd_docs/memory/internal/decisions.md": "# x\n" });
    try {
      const notSynced = sync(root);
      assert.equal(read(root, "CLAUDE.md"), team, line);
      assert.match(notSynced.join("\n"), /holds a line the memory block would not write/u, line);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("a session start leaves a team line shaped like a generated one in place", () => {
  const team = `${OPEN}\n\n@aidd_docs/memory/architecture.md\n- aidd_docs/ui/ is owned by the design team, ask Ana before editing\n\n${CLOSE}\n`;
  const root = sandbox({ "CLAUDE.md": team });
  try {
    const payload = JSON.stringify({ hook_event_name: "SessionStart", session_id: "sync-team-line", cwd: root, source: "startup" });
    const result = spawnSync(process.execPath, [HOOK, "load"], { cwd: root, env: HOOK_ENV, input: payload, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(read(root, "CLAUDE.md"), team);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a stale generated line is still the generator's own: it is rewritten, not held", () => {
  const stale = `${OPEN}\n\n@aidd_docs/memory/deleted.md\n\n- aidd_docs/old/\n\n${CLOSE}\n`;
  const root = sandbox({ "CLAUDE.md": stale });
  try {
    assert.deepEqual(sync(root), []);
    assert.equal(read(root, "CLAUDE.md"), `${FILLED_AT}\n`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CLAUDE.md linked to AGENTS.md is written once, in the @ form Claude Code loads", () => {
  const root = sandbox({ "AGENTS.md": EMPTY }, { "CLAUDE.md": "AGENTS.md" });
  try {
    assert.deepEqual(sync(root), []);
    assert.equal(read(root, "CLAUDE.md"), `# P\n\n${FILLED_AT}\n`);
    assert.equal(read(root, "AGENTS.md"), read(root, "CLAUDE.md"));
    assert.ok(fs.lstatSync(path.join(root, "CLAUDE.md")).isSymbolicLink(), "the link stays a link");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a file linked from two other names takes the link form once, climbing from the real file", () => {
  const root = sandbox({ "AGENTS.md": EMPTY }, { ".github/copilot-instructions.md": "../AGENTS.md" });
  try {
    assert.deepEqual(sync(root), []);
    assert.equal(read(root, "AGENTS.md"), `# P\n\n${OPEN}\n\n[aidd_docs/memory/architecture.md](aidd_docs/memory/architecture.md)\n\n${CLOSE}\n`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a link climbs from the real file, not from the name that reaches it", () => {
  const root = sandbox({ "docs/agents.md": EMPTY }, { "AGENTS.md": "docs/agents.md" });
  try {
    assert.deepEqual(sync(root), []);
    assert.equal(read(root, "docs/agents.md"), `# P\n\n${OPEN}\n\n[aidd_docs/memory/architecture.md](../aidd_docs/memory/architecture.md)\n\n${CLOSE}\n`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("markers inside a fence, duplicated, malformed or out of order leave the file as it is, reported", () => {
  const cases = {
    fenced: ["```", OPEN, CLOSE, "```", ""].join("\n"),
    duplicated: `${EMPTY}\n${OPEN}\n${CLOSE}\n`,
    "two starts": `${OPEN}\n${OPEN}\n${CLOSE}\n`,
    malformed: "<!--aidd_project_memory:start-->\n<!-- aidd_project_memory:end -->\n",
    "out of order": `${CLOSE}\n${OPEN}\n`,
  };
  const reasons = { fenced: /inside a code fence/u, duplicated: /duplicated/u, "two starts": /duplicated/u, malformed: /malformed/u, "out of order": /out of order/u };
  for (const [name, content] of Object.entries(cases)) {
    const root = sandbox({ "CLAUDE.md": content });
    try {
      const notSynced = sync(root);
      assert.equal(read(root, "CLAUDE.md"), content, name);
      assert.match(notSynced.join("\n"), reasons[name], name);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("a quoted pair in a fence beside a real block does not stop the real one", () => {
  const root = sandbox({ "CLAUDE.md": `\`\`\`\n${OPEN}\n${CLOSE}\n\`\`\`\n\n${EMPTY}` });
  try {
    assert.deepEqual(sync(root), []);
    assert.match(read(root, "CLAUDE.md"), /@aidd_docs\/memory\/architecture\.md/u);
    assert.match(read(root, "CLAUDE.md"), /^```\n<!-- aidd_project_memory:start -->\n<!-- aidd_project_memory:end -->\n```\n/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a CRLF file keeps CRLF, and an unchanged block is not rewritten", () => {
  const crlf = (text) => text.replace(/\n/gu, "\r\n");
  const root = sandbox({ "CLAUDE.md": crlf(EMPTY) });
  try {
    sync(root);
    const once = read(root, "CLAUDE.md");
    assert.equal(once, crlf(`# P\n\n${FILLED_AT}\n`));
    assert.ok(!/(?<!\r)\n/u.test(once), "every line break stays CRLF");
    const before = fs.statSync(path.join(root, "CLAUDE.md")).mtimeMs;
    sync(root);
    assert.equal(fs.statSync(path.join(root, "CLAUDE.md")).mtimeMs, before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("sync is silent about a read-only or missing target it has no block for", () => {
  const root = sandbox({});
  try {
    assert.deepEqual(sync(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// Copilot reads AGENTS.md, so its own file only points there: a block copied into both files
// would load the memory twice. The wiring adds the pointer; the sync only retires an old block.
const POINTER = "Project memory: [AGENTS.md](../AGENTS.md).";
const COPILOT = ".github/copilot-instructions.md";
const exists = (root, name) => fs.existsSync(path.join(root, name));

test("sync never creates copilot-instructions.md, nor adds the pointer to a team's file: that is the wiring's", () => {
  const team = "# Team rules\n\nAlways answer in French.\n";
  const bare = sandbox({ "AGENTS.md": EMPTY });
  const teamed = sandbox({ [COPILOT]: team, "AGENTS.md": EMPTY });
  try {
    assert.deepEqual(sync(bare), []);
    assert.equal(exists(bare, COPILOT), false, "a sync created the copilot file");
    assert.deepEqual(sync(teamed), []);
    assert.equal(read(teamed, COPILOT), team, "a sync added the pointer");
  } finally {
    fs.rmSync(bare, { recursive: true, force: true });
    fs.rmSync(teamed, { recursive: true, force: true });
  }
});

test("a memory block left in copilot-instructions.md becomes the pointer line", () => {
  const old = `# Team\n\n${OPEN}\n\n[aidd_docs/memory/architecture.md](../aidd_docs/memory/architecture.md)\n\n${CLOSE}\n\nAfter.\n`;
  const legacy = "# Team\n\n<aidd_project_memory>\n@aidd_docs/memory/architecture.md\n</aidd_project_memory>\n\nAfter.\n";
  for (const [name, content] of Object.entries({ old, legacy })) {
    const root = sandbox({ [COPILOT]: content, "AGENTS.md": EMPTY });
    try {
      assert.deepEqual(sync(root), [], name);
      assert.equal(read(root, COPILOT), `# Team\n\n${POINTER}\n\nAfter.\n`, name);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("a team line inside the old copilot block is held, never erased", () => {
  const team = `${OPEN}\n\n[aidd_docs/memory/architecture.md](../aidd_docs/memory/architecture.md)\nAsk Ana before editing the ui.\n\n${CLOSE}\n`;
  const root = sandbox({ [COPILOT]: team, "AGENTS.md": EMPTY });
  try {
    const notSynced = sync(root);
    assert.equal(read(root, COPILOT), team);
    assert.match(notSynced.join("\n"), /copilot-instructions\.md holds a line the memory block would not write/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("copilot-instructions.md linked to AGENTS.md is never given the pointer", () => {
  const root = sandbox({ "AGENTS.md": EMPTY }, { [COPILOT]: "../AGENTS.md" });
  try {
    assert.deepEqual(sync(root), []);
    assert.doesNotMatch(read(root, "AGENTS.md"), /Project memory:/u);
    assert.ok(fs.lstatSync(path.join(root, COPILOT)).isSymbolicLink());
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
