const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

// The hook is a script, not a module: the CLI copies it into the user's project,
// where a "type": "module" package.json decides how it is parsed. Driving it as a
// subprocess is the only way to test what actually ships.
const HOOK = path.resolve(__dirname, "../../plugins/aidd-context/hooks/update_memory.js");

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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "update-memory-"));
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
      hook = path.join(root, hookAt);
      fs.mkdirSync(path.dirname(hook), { recursive: true });
      fs.copyFileSync(HOOK, hook);
    }

    const invoke = () => spawnSync(process.execPath, [hook, ...(args ?? ["claude"])], { cwd: root });
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
    hookAt: ".claude/hooks/aidd-context/update_memory.js",
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

test("a context file with no block at all is skipped quietly", () => {
  const result = run({ context: "# P\n\nNo block here.\n" });

  assert.equal(result.stderr, "");
  assert.equal(result.content, "# P\n\nNo block here.\n");
});

test("an unknown tool name is rejected", () => {
  const result = run({ context: `${OPEN}\n${CLOSE}\n`, args: ["emacs"] });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown tool emacs/u);
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

// A link resolves against the file holding it, so a nested context file climbs back out.
// Hardcoding one level makes every root-level link escape the repository.
test("a nested context file prefixes its links with the climb back out", () => {
  const content = run({
    context: `${OPEN}\n${CLOSE}\n`,
    contextAt: ".github/copilot-instructions.md",
    args: ["copilot"],
  }).content;

  assert.match(
    content,
    /^\[aidd_docs\/memory\/architecture\.md\]\(\.\.\/aidd_docs\/memory\/architecture\.md\)$/mu,
  );
});

/** Real files and subprocesses; explicit sync must validate the whole selected set first. */
function inProject(files, check) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "memory-preflight-"));
  try {
    for (const [relative, content] of Object.entries({
      "aidd_docs/memory/architecture.md": "# Architecture\n\n- Runtime memory\n",
      ...files,
    })) {
      const file = path.join(root, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
      !name.startsWith("GIT_") && name !== "CLAUDE_PROJECT_DIR"));
    const invoke = (...args) => spawnSync(process.execPath, [HOOK, ...args], {
      cwd: root, env, encoding: "utf8",
    });
    const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
    check({ root, invoke, read });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const EMPTY_BLOCK = `${OPEN}\n${CLOSE}\n`;

test("Kilo selected alone fills root AGENTS.md without changing other tools or legacy paths", () => {
  inProject({
    "AGENTS.md": `USER PREFIX\n${EMPTY_BLOCK}USER SUFFIX\n`,
    "CLAUDE.md": EMPTY_BLOCK,
    ".github/copilot-instructions.md": EMPTY_BLOCK,
    ".kilocode/keep.md": "legacy user content\n",
  }, ({ root, invoke, read }) => {
    const result = invoke("kilo");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(read("AGENTS.md"), `USER PREFIX\n${OPEN}\n\n[aidd_docs/memory/architecture.md](aidd_docs/memory/architecture.md)\n\n${CLOSE}\nUSER SUFFIX\n`);
    assert.equal(read("CLAUDE.md"), EMPTY_BLOCK);
    assert.equal(read(".github/copilot-instructions.md"), EMPTY_BLOCK);
    assert.equal(read(".kilocode/keep.md"), "legacy user content\n");
    assert.deepEqual(fs.readdirSync(path.join(root, ".kilocode")), ["keep.md"]);
  });
});

test("shared Kilo/Codex/OpenCode/Cursor selection is stable without rewriting on a rerun", () => {
  inProject({ "AGENTS.md": EMPTY_BLOCK }, ({ root, invoke, read }) => {
    const args = ["kilo", "codex", "opencode", "cursor", "kilo"];
    const result = invoke(...args);
    assert.equal(result.status, 0, result.stderr);
    const once = read("AGENTS.md");
    const mtime = fs.statSync(path.join(root, "AGENTS.md"), { bigint: true }).mtimeNs;
    assert.equal(invoke(...args).status, 0);
    assert.equal(read("AGENTS.md"), once);
    assert.equal(fs.statSync(path.join(root, "AGENTS.md"), { bigint: true }).mtimeNs, mtime);
    assert.equal(once.split(OPEN).length - 1, 1);
    assert.equal(once.split("[aidd_docs/memory/architecture.md]").length - 1, 1);
  });
});

test("explicit sync validates a last malformed destination before writing earlier targets or README", () => {
  const files = {
    "CLAUDE.md": EMPTY_BLOCK,
    "AGENTS.md": EMPTY_BLOCK,
    ".github/copilot-instructions.md": `${OPEN}\n`,
    "aidd_docs/memory/README.md": "# Memory\n<!-- files:start -->\n<!-- files:end -->\n",
  };
  inProject(files, ({ invoke, read }) => {
    const result = invoke("claude", "codex", "copilot");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unpaired project memory marker/);
    for (const [name, content] of Object.entries(files)) assert.equal(read(name), content, name);
  });
});

for (const [name, invalid] of Object.entries({
  duplicate: EMPTY_BLOCK + EMPTY_BLOCK,
  nested: `${OPEN}\n${OPEN}\n${CLOSE}\n`,
  reversed: `${CLOSE}\n${OPEN}\n`,
  mixed: `<aidd_project_memory>\n${CLOSE}\n`,
  separateFamilies: EMPTY_BLOCK + "<aidd_project_memory>\n</aidd_project_memory>\n",
  extraClose: EMPTY_BLOCK + `${CLOSE}\n`,
})) {
  test(`explicit sync refuses ${name} memory markers without changing any selected file`, () => {
    inProject({ "CLAUDE.md": EMPTY_BLOCK, "AGENTS.md": invalid }, ({ invoke, read }) => {
      const result = invoke("claude", "codex");
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, /memory marker/);
      assert.equal(read("CLAUDE.md"), EMPTY_BLOCK);
      assert.equal(read("AGENTS.md"), invalid);
    });
  });
}

test("preflight accepts absent/blockless context files but performs no Upsert or Fill", () => {
  inProject({ "AGENTS.md": "# User\nNo block yet.\n" }, ({ root, invoke, read }) => {
    const result = invoke("--check", "claude", "codex", "copilot");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(read("AGENTS.md"), "# User\nNo block yet.\n");
    assert.equal(fs.existsSync(path.join(root, "CLAUDE.md")), false);
    assert.equal(fs.existsSync(path.join(root, ".github")), false);
  });
});

test("preflight refuses malformed existing context before any missing target is created", () => {
  inProject({ "AGENTS.md": `${OPEN}\n` }, ({ root, invoke, read }) => {
    const result = invoke("--check", "claude", "codex");
    assert.equal(result.status, 1);
    assert.equal(fs.existsSync(path.join(root, "CLAUDE.md")), false);
    assert.equal(read("AGENTS.md"), `${OPEN}\n`);
  });
});

test("a malformed opted-in README prevents all explicit context writes", () => {
  inProject({ "CLAUDE.md": EMPTY_BLOCK, "aidd_docs/memory/README.md": "<!-- files:start -->\n" }, ({ invoke, read }) => {
    const result = invoke("claude");
    assert.equal(result.status, 1, result.stderr);
    assert.equal(read("CLAUDE.md"), EMPTY_BLOCK);
    assert.equal(read("aidd_docs/memory/README.md"), "<!-- files:start -->\n");
  });
});

test("explicit sync ignores marker examples in prose and fences", () => {
  const examples = `Quoted \`${OPEN}\` only.\n\n\`\`\`\`markdown\n\`\`\`\n${CLOSE}\n\`\`\`\n\`\`\`\`\n`;
  inProject({ "AGENTS.md": examples }, ({ invoke, read }) => {
    const result = invoke("codex");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(read("AGENTS.md"), examples);
  });
});

for (const [name, content] of Object.entries({
  quoted: `Quoted \`${OPEN}\` only.\n`,
  fenced: `\`\`\`markdown\n${CLOSE}\n\`\`\`\n`,
})) {
  test(`explicit sync ignores a lone ${name} marker example`, () => {
    inProject({ "AGENTS.md": content }, ({ invoke, read }) => {
      const result = invoke("codex");
      assert.equal(result.status, 0, result.stderr);
      assert.equal(read("AGENTS.md"), content);
    });
  });
}

test("explicit fill preserves BOM, CRLF, marker indentation and user bytes without a final newline", () => {
  const prefix = "\ufeff# User é\r\nKeep\n  ";
  const suffix = `  ${CLOSE}\r\nUSER END`;
  inProject({ "AGENTS.md": `${prefix}${OPEN}\r\nold\r\n${suffix}` }, ({ invoke, read }) => {
    const result = invoke("codex");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(read("AGENTS.md"), `${prefix}${OPEN}\r\n\r\n[aidd_docs/memory/architecture.md](aidd_docs/memory/architecture.md)\r\n\r\n${suffix}`);
  });
});

for (const kind of ["target", "ancestor", "directory"]) {
  test(`explicit sync refuses a ${kind} unsafe destination before writing a valid sibling`, () => {
    inProject({ "CLAUDE.md": EMPTY_BLOCK, "outside.md": EMPTY_BLOCK }, ({ root, invoke, read }) => {
      if (kind === "target") fs.symlinkSync(path.join(root, "outside.md"), path.join(root, "AGENTS.md"));
      if (kind === "ancestor") {
        fs.mkdirSync(path.join(root, "elsewhere"));
        fs.writeFileSync(path.join(root, "elsewhere/copilot-instructions.md"), EMPTY_BLOCK);
        fs.symlinkSync(path.join(root, "elsewhere"), path.join(root, ".github"), "dir");
      }
      if (kind === "directory") fs.mkdirSync(path.join(root, "AGENTS.md"));
      const result = invoke("claude", kind === "ancestor" ? "copilot" : "codex");
      assert.equal(result.status, 1, result.stderr);
      assert.equal(read("CLAUDE.md"), EMPTY_BLOCK);
      assert.equal(read("outside.md"), EMPTY_BLOCK);
    });
  });
}

test("an invalid unselected context cannot prevent a selected tool from filling", () => {
  inProject({ "AGENTS.md": `${OPEN}\n`, "CLAUDE.md": EMPTY_BLOCK }, ({ invoke, read }) => {
    const result = invoke("claude");
    assert.equal(result.status, 0, result.stderr);
    assert.match(read("CLAUDE.md"), /@aidd_docs\/memory\/architecture.md/);
    assert.equal(read("AGENTS.md"), `${OPEN}\n`);
  });
});

test("the automatic hook remains best-effort when a later context has an unpaired marker", () => {
  inProject({ "CLAUDE.md": EMPTY_BLOCK, "AGENTS.md": `${OPEN}\n` }, ({ invoke, read }) => {
    const result = invoke();
    assert.equal(result.status, 0, result.stderr);
    assert.match(read("CLAUDE.md"), /@aidd_docs\/memory\/architecture.md/);
    assert.equal(read("AGENTS.md"), `${OPEN}\n`);
  });
});

test("a read-only last destination fails preflight before any earlier write", () => {
  inProject({ "CLAUDE.md": EMPTY_BLOCK, "AGENTS.md": EMPTY_BLOCK }, ({ root, invoke, read }) => {
    fs.chmodSync(path.join(root, "AGENTS.md"), 0o444);
    const result = invoke("claude", "codex");
    assert.equal(result.status, 1, result.stderr);
    assert.equal(read("CLAUDE.md"), EMPTY_BLOCK);
    assert.equal(read("AGENTS.md"), EMPTY_BLOCK);
  });
});

test("a blockless README symlink is not an opted-in destination", () => {
  inProject({ "CLAUDE.md": EMPTY_BLOCK, "notes.md": "# User notes\n" }, ({ root, invoke, read }) => {
    fs.symlinkSync(path.join(root, "notes.md"), path.join(root, "aidd_docs/memory/README.md"));
    const result = invoke("claude");
    assert.equal(result.status, 0, result.stderr);
    assert.match(read("CLAUDE.md"), /@aidd_docs\/memory\/architecture\.md/);
    assert.equal(read("notes.md"), "# User notes\n");
  });
});

test("preflight refuses an unwritable creation parent without creating any context", () => {
  inProject({ "AGENTS.md": "# User\n" }, ({ root, invoke, read }) => {
    const parent = path.join(root, ".github");
    fs.mkdirSync(parent);
    fs.chmodSync(parent, 0o555);
    try {
      const result = invoke("--check", "claude", "copilot");
      assert.equal(result.status, 1, result.stderr);
      assert.equal(fs.existsSync(path.join(root, "CLAUDE.md")), false);
      assert.equal(fs.existsSync(path.join(parent, "copilot-instructions.md")), false);
      assert.equal(read("AGENTS.md"), "# User\n");
    } finally { fs.chmodSync(parent, 0o755); }
  });
});

test("an unsafe opted-in README refuses sync before any context write", () => {
  inProject({ "CLAUDE.md": EMPTY_BLOCK, "notes.md": "<!-- files:start -->\n<!-- files:end -->\n" }, ({ root, invoke, read }) => {
    fs.symlinkSync(path.join(root, "notes.md"), path.join(root, "aidd_docs/memory/README.md"));
    const result = invoke("claude");
    assert.equal(result.status, 1, result.stderr);
    assert.equal(read("CLAUDE.md"), EMPTY_BLOCK);
    assert.equal(read("notes.md"), "<!-- files:start -->\n<!-- files:end -->\n");
  });
});
