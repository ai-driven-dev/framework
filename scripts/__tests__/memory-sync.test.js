const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

// The entry is a script: the CLI copies the plugin's hooks into the user's project, where a
// "type": "module" package.json decides how it is parsed. Driving it as a subprocess is the
// only way to test what actually ships.
const HOOKS = path.resolve(__dirname, "../../plugins/aidd-context/hooks");
const HOOK = path.join(HOOKS, "memory.cjs");
const HOOK_ENV = { ...process.env };

const OPEN = "<!-- aidd_project_memory:start -->";
const CLOSE = "<!-- aidd_project_memory:end -->";

/** A throwaway project with a memory bank, a context file, and the hook run in it. */
function run({
  context,
  contextAt = "CLAUDE.md",
  bank = ["architecture.md"],
  onDemand = [],
  packageJson,
  hookAt,
  args,
  runs = 1,
}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "memory-sync-"));
  try {
    fs.mkdirSync(path.join(root, "aidd_docs/memory"), { recursive: true });
    for (const file of bank) fs.writeFileSync(path.join(root, "aidd_docs/memory", file), "# x\n");
    for (const file of onDemand) {
      const full = path.join(root, "aidd_docs/memory", file);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, "# x\n");
    }
    if (context !== undefined) {
      const target = path.join(root, contextAt);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, context);
    }
    if (packageJson) fs.writeFileSync(path.join(root, "package.json"), packageJson);

    // Copying the hook in mirrors how the CLI installs it, so the project's own
    // package.json governs the module system exactly as it does for a user.
    let hook = HOOK;
    if (hookAt) {
      fs.cpSync(HOOKS, path.join(root, hookAt), { recursive: true });
      hook = path.join(root, hookAt, "memory.cjs");
    }

    const invoke = () => spawnSync(process.execPath, [hook, "sync", ...(args ?? ["claude"])], { cwd: root, env: HOOK_ENV });
    const read = () => fs.readFileSync(path.join(root, contextAt), "utf8");

    const first = invoke();
    const content = read();
    // Read everything before the finally below removes the project.
    return {
      status: first.status,
      stderr: first.stderr.toString(),
      content,
      contentAfterRerun: runs > 1 ? (invoke(), read()) : content,
    };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("the hook runs in a project declaring itself an ES module", () => {
  const run1 = run({
    context: `# P\n\n${OPEN}\n${CLOSE}\n`,
    packageJson: '{ "type": "module" }\n',
    hookAt: ".claude/hooks/aidd-context",
  });

  assert.equal(run1.stderr, "");
  assert.equal(run1.status, 0);
  assert.match(run1.content, /@aidd_docs\/memory\/architecture\.md/u);
});

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

  assert.match(result.stderr, /unpaired project memory marker/u);
});

test("an unknown tool name is rejected", () => {
  const result = run({ context: `${OPEN}\n${CLOSE}\n`, args: ["emacs"] });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown tool emacs/u);
});

test("antigravity refreshes AGENTS.md, the context file agy reads", () => {
  const result = run({
    context: `${OPEN}\n${CLOSE}\n`,
    contextAt: "AGENTS.md",
    args: ["antigravity"],
  });

  assert.equal(result.status, 0);
  assert.match(result.content, /^\[aidd_docs\/memory\/architecture\.md\]\(aidd_docs\/memory\/architecture\.md\)$/mu);
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

test("an unpaired marker fails the run when the skill named the tools", () => {
  const result = run({ context: `# P\n\n${OPEN}\n@stale.md\n` });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /unpaired project memory marker/u);
});

// The @ import form is Claude-only. AGENTS.md is read by codex, cursor and
// opencode, none of which resolve it, so an @ line there was inert text.
test("AGENTS.md gets markdown links, resolvable from the repository root", () => {
  const content = run({
    context: `${OPEN}\n${CLOSE}\n`,
    contextAt: "AGENTS.md",
    args: ["codex"],
  }).content;

  assert.match(content, /^\[aidd_docs\/memory\/architecture\.md\]\(aidd_docs\/memory\/architecture\.md\)$/mu);
  assert.doesNotMatch(content, /\(\.\.\//u);
});

// The README sits inside the memory directory, so its links are relative to it. The path
// is joined with the platform separator but the file paths are normalised to "/", so a
// replace on the joined form silently matches nothing on Windows.
test("the memory README lists its files relative to itself, on every platform's separator", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "memory-sync-"));
  try {
    const memory = path.join(root, "aidd_docs/memory");
    fs.mkdirSync(path.join(memory, "internal/decisions"), { recursive: true });
    fs.writeFileSync(path.join(memory, "architecture.md"), "# x\n");
    fs.writeFileSync(path.join(memory, "internal/decisions/x.md"), "# x\n");
    fs.writeFileSync(path.join(memory, "README.md"), "<!-- files:start -->\n<!-- files:end -->\n");
    fs.writeFileSync(path.join(root, "CLAUDE.md"), `${OPEN}\n${CLOSE}\n`);

    const result = spawnSync(process.execPath, [HOOK, "sync", "claude"], { cwd: root, env: HOOK_ENV });
    assert.equal(result.status, 0, result.stderr.toString());

    const readme = fs.readFileSync(path.join(memory, "README.md"), "utf8");
    const toc = readme.slice(readme.indexOf("<!-- files:start -->"), readme.indexOf("<!-- files:end -->"));
    assert.match(toc, /^- \[architecture\.md\]\(architecture\.md\)$/mu);
    assert.match(toc, /^- \[internal\/decisions\/x\.md\]\(internal\/decisions\/x\.md\)$/mu);
    assert.doesNotMatch(toc, /aidd_docs\/memory\//u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the block lists every aidd_docs/ folder other than the bank, read on demand, after the bank's own files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "memory-sync-"));
  try {
    for (const dir of ["memory/internal", "ui", "pm", "tasks"]) fs.mkdirSync(path.join(root, "aidd_docs", dir), { recursive: true });
    fs.writeFileSync(path.join(root, "aidd_docs/memory/architecture.md"), "# x\n");
    fs.writeFileSync(path.join(root, "aidd_docs/memory/internal/d.md"), "# x\n");
    fs.writeFileSync(path.join(root, "aidd_docs/notes.md"), "# a file, not a folder\n");
    fs.writeFileSync(path.join(root, "CLAUDE.md"), `${OPEN}\n${CLOSE}\n`);
    const result = spawnSync(process.execPath, [HOOK, "sync"], { cwd: root, env: HOOK_ENV });
    assert.equal(result.status, 0, result.stderr.toString());
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

function sync(root, ...tools) {
  const result = spawnSync(process.execPath, [HOOK, "sync", ...tools], { cwd: root, env: HOOK_ENV, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

const read = (root, name) => fs.readFileSync(path.join(root, name), "utf8");
const EMPTY = `# P\n\n${OPEN}\n${CLOSE}\n`;
const FILLED_AT = `${OPEN}\n\n@aidd_docs/memory/architecture.md\n\n${CLOSE}`;

// A tool picked with --add: its context file gains the block it lacks. Without it, and at a session
// start, sync only refreshes the blocks that already stand.
const TEAM = "# Team\n\n```md\n@README.md\n```\n\n- Answer in French.\n";
const FILLED_LINK = `${OPEN}\n\n[aidd_docs/memory/architecture.md](aidd_docs/memory/architecture.md)\n\n${CLOSE}`;

// Every other command takes the root as `.`; a model copies it onto sync.
test("a root or path given to sync is refused with the fix, and nothing is written", () => {
  for (const arg of [".", "./", "../proj", "/tmp/proj"]) {
    const root = sandbox({ "CLAUDE.md": TEAM });
    try {
      const result = sync(root, "claude", arg);
      assert.equal(result.status, 1, arg);
      assert.equal(result.stderr, `memory: sync takes tool names, run it from the project root (got "${arg}")\n`, arg);
      assert.equal(read(root, "CLAUDE.md"), TEAM, arg);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("sync --add appends the block a picked tool's file lacks, after the team's content left byte for byte", () => {
  const root = sandbox({ "CLAUDE.md": TEAM, "AGENTS.md": TEAM });
  try {
    const result = sync(root, "--add", "claude");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(read(root, "CLAUDE.md"), `${TEAM}\n${FILLED_AT}\n`);
    assert.equal(result.stderr, "memory: CLAUDE.md had no project memory block, added at its end\n");
    assert.equal(read(root, "AGENTS.md"), TEAM, "an unpicked tool's file is left alone");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("naming a tool without --add only fills a block that stands, and names the fix for a file holding none", () => {
  const root = sandbox({ "CLAUDE.md": TEAM, "AGENTS.md": EMPTY });
  try {
    const result = sync(root, "codex", "claude");
    assert.deepEqual(result, { status: 0, stdout: "", stderr: "memory: CLAUDE.md has no memory block; run sync --add claude to add one\n" });
    assert.equal(read(root, "CLAUDE.md"), TEAM);
    assert.equal(read(root, "AGENTS.md"), `# P\n\n${FILLED_LINK}\n`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("AGENTS.md gains the block in the link form, and a second run changes nothing", () => {
  const root = sandbox({ "AGENTS.md": "# Agents\nNo trailing newline" });
  try {
    assert.equal(sync(root, "--add", "codex").status, 0);
    const once = read(root, "AGENTS.md");
    assert.equal(once, `# Agents\nNo trailing newline\n\n${FILLED_LINK}\n`);
    const again = sync(root, "--add", "codex");
    assert.equal(read(root, "AGENTS.md"), once);
    assert.equal(again.stderr, "", "a second run reports no addition");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a CRLF file gains the block in CRLF, and an empty file the block alone", () => {
  const crlf = (text) => text.replace(/\n/gu, "\r\n");
  const root = sandbox({ "CLAUDE.md": crlf(TEAM), "AGENTS.md": "" });
  try {
    assert.equal(sync(root, "--add", "claude", "codex").status, 0);
    assert.equal(read(root, "CLAUDE.md"), crlf(`${TEAM}\n${FILLED_AT}\n`));
    assert.equal(read(root, "AGENTS.md"), `${FILLED_LINK}\n`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a session start, or a sync naming no tool, never adds a block to a file holding none", () => {
  const root = sandbox({ "CLAUDE.md": TEAM, "AGENTS.md": TEAM });
  try {
    const payload = JSON.stringify({ hook_event_name: "SessionStart", session_id: "sync-no-block", cwd: root, source: "startup" });
    const hook = spawnSync(process.execPath, [HOOK, "hook"], { cwd: root, env: HOOK_ENV, input: payload, encoding: "utf8" });
    assert.equal(hook.status, 0, hook.stderr);
    assert.equal(read(root, "CLAUDE.md"), TEAM, "the session start added a block");
    assert.deepEqual(sync(root, "--add"), { status: 0, stdout: "", stderr: "" });
    assert.deepEqual(sync(root), { status: 0, stdout: "", stderr: "" }, "a bare sync spoke about a file it never adds to");
    assert.equal(read(root, "CLAUDE.md"), TEAM, "a sync naming no tool added a block");
    assert.equal(read(root, "AGENTS.md"), TEAM);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CLAUDE.md linked to AGENTS.md with no block gains one block, in the @ form", () => {
  const root = sandbox({ "AGENTS.md": TEAM }, { "CLAUDE.md": "AGENTS.md" });
  try {
    assert.equal(sync(root, "--add", "claude", "codex").status, 0);
    assert.equal(read(root, "AGENTS.md"), `${TEAM}\n${FILLED_AT}\n`);
    assert.ok(fs.lstatSync(path.join(root, "CLAUDE.md")).isSymbolicLink(), "the link stays a link");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a link to nothing and a copilot file linked to AGENTS.md are still never written", () => {
  const root = sandbox({ "AGENTS.md": TEAM }, { "CLAUDE.md": "gone.md", [".github/copilot-instructions.md"]: "../AGENTS.md" });
  try {
    assert.equal(sync(root, "--add", "claude", "copilot").status, 0);
    assert.equal(fs.existsSync(path.join(root, "gone.md")), false, "a dangling link was followed");
    assert.equal(read(root, "AGENTS.md"), `${TEAM}\n${FILLED_LINK}\n`, "copilot's pick fills AGENTS.md once, with no pointer");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a file reached through a link leaving the project is never given a block", () => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "memory-sync-shared-"));
  fs.writeFileSync(path.join(outside, "G.md"), TEAM);
  const root = sandbox({}, { "CLAUDE.md": path.join(outside, "G.md") });
  try {
    const result = sync(root, "--add", "claude");
    assert.equal(result.status, 1);
    assert.equal(result.stderr, "memory: CLAUDE.md links outside the project, not synced\n");
    assert.equal(fs.readFileSync(path.join(outside, "G.md"), "utf8"), TEAM);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test("a file ending inside an open code fence is never given a block", () => {
  const open = "# P\n\n```md\n@README.md\n";
  const root = sandbox({ "CLAUDE.md": open });
  try {
    const result = sync(root, "--add", "claude");
    assert.equal(result.status, 1);
    assert.equal(result.stderr, "memory: CLAUDE.md ends inside a code fence, not synced\n");
    assert.equal(read(root, "CLAUDE.md"), open);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a target that cannot be written is named, and the others still sync", (t) => {
  if (process.getuid?.() === 0) return t.skip("root writes through a read-only file");
  const root = sandbox({ "CLAUDE.md": EMPTY, "AGENTS.md": EMPTY });
  try {
    fs.chmodSync(path.join(root, "CLAUDE.md"), 0o444);
    const result = sync(root);
    // Windows refuses a write to a read-only file with EPERM, POSIX with EACCES.
    const code = process.platform === "win32" ? "EPERM" : "EACCES";
    assert.match(result.stderr, new RegExp(`memory: CLAUDE\\.md not written \\(${code}\\), skipped`, "u"));
    assert.match(read(root, "AGENTS.md"), /\[aidd_docs\/memory\/architecture\.md\]\(aidd_docs\/memory\/architecture\.md\)/u);
    assert.equal(read(root, "CLAUDE.md"), EMPTY);
    assert.equal(sync(root, "claude", "codex").status, 1, "naming the tools fails the run");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a line the generator would not write in the block leaves the file as it is, and is reported", () => {
  const team = `${OPEN}\n\n@aidd_docs/memory/architecture.md\n@docs/team-glossary.md\n\n${CLOSE}\n`;
  const root = sandbox({ "CLAUDE.md": team });
  try {
    const result = sync(root, "claude");
    assert.equal(read(root, "CLAUDE.md"), team);
    assert.match(result.stderr, /CLAUDE\.md holds a line the memory block would not write \("@docs\/team-glossary\.md"\), not synced/u);
    assert.equal(result.status, 1);
    assert.equal(sync(root).status, 0, "an unnamed run never fails over a file to repair");
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
      const result = sync(root, "claude");
      assert.equal(read(root, "CLAUDE.md"), team, line);
      assert.match(result.stderr, /holds a line the memory block would not write/u, line);
      assert.equal(result.status, 1, line);
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
    const result = spawnSync(process.execPath, [HOOK, "hook"], { cwd: root, env: HOOK_ENV, input: payload, encoding: "utf8" });
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
    assert.equal(sync(root, "claude").status, 0);
    assert.equal(read(root, "CLAUDE.md"), `${FILLED_AT}\n`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CLAUDE.md linked to AGENTS.md is written once, in the @ form Claude Code loads", () => {
  const root = sandbox({ "AGENTS.md": EMPTY }, { "CLAUDE.md": "AGENTS.md" });
  try {
    assert.equal(sync(root).status, 0);
    assert.equal(read(root, "CLAUDE.md"), `# P\n\n${FILLED_AT}\n`);
    assert.equal(read(root, "AGENTS.md"), read(root, "CLAUDE.md"));
    assert.ok(fs.lstatSync(path.join(root, "CLAUDE.md")).isSymbolicLink(), "the link stays a link");
    assert.equal(sync(root, "codex").status, 0);
    assert.equal(read(root, "AGENTS.md"), `# P\n\n${FILLED_AT}\n`, "naming only the other name keeps the form");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a file linked from two other names takes the link form once, climbing from the real file", () => {
  const root = sandbox({ "AGENTS.md": EMPTY }, { ".github/copilot-instructions.md": "../AGENTS.md" });
  try {
    assert.equal(sync(root).status, 0);
    assert.equal(read(root, "AGENTS.md"), `# P\n\n${OPEN}\n\n[aidd_docs/memory/architecture.md](aidd_docs/memory/architecture.md)\n\n${CLOSE}\n`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a link climbs from the real file, not from the name that reaches it", () => {
  const root = sandbox({ "docs/agents.md": EMPTY }, { "AGENTS.md": "docs/agents.md" });
  try {
    assert.equal(sync(root, "codex").status, 0);
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
      const result = sync(root, "claude");
      assert.equal(read(root, "CLAUDE.md"), content, name);
      assert.match(result.stderr, reasons[name], name);
      assert.equal(result.status, 1, name);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("a quoted pair in a fence beside a real block does not stop the real one", () => {
  const root = sandbox({ "CLAUDE.md": `\`\`\`\n${OPEN}\n${CLOSE}\n\`\`\`\n\n${EMPTY}` });
  try {
    assert.equal(sync(root, "claude").status, 0);
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
    sync(root, "claude");
    const once = read(root, "CLAUDE.md");
    assert.equal(once, crlf(`# P\n\n${FILLED_AT}\n`));
    assert.ok(!/(?<!\r)\n/u.test(once), "every line break stays CRLF");
    const before = fs.statSync(path.join(root, "CLAUDE.md")).mtimeMs;
    sync(root, "claude");
    assert.equal(fs.statSync(path.join(root, "CLAUDE.md")).mtimeMs, before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("sync is silent about a read-only or missing target it has no block for", () => {
  const root = sandbox({});
  try {
    assert.deepEqual(sync(root), { status: 0, stdout: "", stderr: "" });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the setup copies aidd_docs/README.md only when the project has none", () => {
  const skill = path.resolve(__dirname, "../../plugins/aidd-context/skills/02-project-memory");
  const write = fs.readFileSync(path.join(skill, "actions/02-write.md"), "utf8");
  assert.match(write, /aidd_docs\/README\.md[^\n]*only when (?:it is )?absent/u);
});

// Copilot reads AGENTS.md, so its own file only points there: a block copied into both files
// would load the memory twice.
const POINTER = "Project memory: [AGENTS.md](../AGENTS.md).";
const COPILOT = ".github/copilot-instructions.md";
const exists = (root, name) => fs.existsSync(path.join(root, name));

test("picking copilot fills AGENTS.md and creates copilot-instructions.md with the one pointer line", () => {
  const root = sandbox({ "AGENTS.md": EMPTY });
  try {
    assert.equal(sync(root, "copilot").status, 0);
    assert.match(read(root, "AGENTS.md"), /^\[aidd_docs\/memory\/architecture\.md\]\(aidd_docs\/memory\/architecture\.md\)$/mu);
    assert.equal(read(root, COPILOT), `${POINTER}\n`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("copilot-instructions.md is created only when copilot is picked", () => {
  const root = sandbox({ "AGENTS.md": EMPTY });
  try {
    assert.equal(sync(root, "codex").status, 0);
    assert.equal(exists(root, COPILOT), false, "naming codex created the copilot file");
    assert.equal(sync(root).status, 0);
    assert.equal(exists(root, COPILOT), false, "a session start created the copilot file");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a team's copilot-instructions.md keeps its content and gains the pointer once", () => {
  const team = "# Team rules\n\nAlways answer in French.\n";
  const root = sandbox({ [COPILOT]: team, "AGENTS.md": EMPTY });
  try {
    assert.equal(sync(root, "copilot").status, 0);
    assert.equal(read(root, COPILOT), `${team}\n${POINTER}\n`);
    assert.equal(sync(root, "copilot").status, 0);
    assert.equal(read(root, COPILOT), `${team}\n${POINTER}\n`, "a second run adds it again");
    assert.equal(sync(root, "codex").status, 0);
    assert.equal(read(root, COPILOT), `${team}\n${POINTER}\n`, "an unpicked tool's file is left alone");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a memory block left in copilot-instructions.md becomes the pointer line, on a pick and at a session start", () => {
  const old = `# Team\n\n${OPEN}\n\n[aidd_docs/memory/architecture.md](../aidd_docs/memory/architecture.md)\n\n${CLOSE}\n\nAfter.\n`;
  const legacy = "# Team\n\n<aidd_project_memory>\n@aidd_docs/memory/architecture.md\n</aidd_project_memory>\n\nAfter.\n";
  for (const [content, args] of [[old, ["copilot"]], [old, []], [legacy, ["copilot"]], [legacy, []]]) {
    const root = sandbox({ [COPILOT]: content, "AGENTS.md": EMPTY });
    try {
      assert.equal(sync(root, ...args).status, 0);
      assert.equal(read(root, COPILOT), `# Team\n\n${POINTER}\n\nAfter.\n`, `${args}`);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("a team line inside the old copilot block is held, never erased", () => {
  const team = `${OPEN}\n\n[aidd_docs/memory/architecture.md](../aidd_docs/memory/architecture.md)\nAsk Ana before editing the ui.\n\n${CLOSE}\n`;
  const root = sandbox({ [COPILOT]: team, "AGENTS.md": EMPTY });
  try {
    const result = sync(root, "copilot");
    assert.equal(read(root, COPILOT), team);
    assert.match(result.stderr, /copilot-instructions\.md holds a line the memory block would not write/u);
    assert.equal(result.status, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("copilot-instructions.md linked to AGENTS.md is never given the pointer", () => {
  const root = sandbox({ "AGENTS.md": EMPTY }, { [COPILOT]: "../AGENTS.md" });
  try {
    assert.equal(sync(root, "copilot").status, 0);
    assert.doesNotMatch(read(root, "AGENTS.md"), /Project memory:/u);
    assert.ok(fs.lstatSync(path.join(root, COPILOT)).isSymbolicLink());
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("naming another tool leaves an old copilot block as it is", () => {
  const old = `${OPEN}\n\n[aidd_docs/memory/architecture.md](../aidd_docs/memory/architecture.md)\n\n${CLOSE}\n`;
  const root = sandbox({ [COPILOT]: old, "AGENTS.md": EMPTY });
  try {
    assert.equal(sync(root, "codex").status, 0);
    assert.equal(read(root, COPILOT), old);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
