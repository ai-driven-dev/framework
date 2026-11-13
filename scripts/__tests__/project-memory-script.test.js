const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

// The skill's own script, driven as the skill runs it: a subprocess from the project root.
const SKILL = path.resolve(__dirname, "../../plugins/aidd-context/skills/02-project-memory");
const SCRIPT = path.join(SKILL, "scripts/project-memory.cjs");
const TEMPLATES = path.join(SKILL, "assets/templates");
const HOOK = path.resolve(__dirname, "../../plugins/aidd-context/hooks/memory.cjs");
const MEMORY = "aidd_docs/memory";
const OPEN = "<!-- aidd_project_memory:start -->";
const CLOSE = "<!-- aidd_project_memory:end -->";
const POINTER = "Project memory: [AGENTS.md](../AGENTS.md).";
const COPILOT = ".github/copilot-instructions.md";
const ALWAYS = ["project-brief.md", "architecture.md", "codebase-map.md", "coding-assertions.md", "testing.md", "vcs.md", "ecosystem.md"];
// A hook runs with GIT_DIR and GIT_INDEX_FILE set: a git that inherits them acts on the repository being committed.
const OUTSIDE_GIT = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
const GIT_ENV = { ...OUTSIDE_GIT, GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };

function project(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "project-memory-"));
  for (const [name, text] of Object.entries(files)) write(root, name, text);
  return root;
}

function write(root, name, text) {
  const full = path.join(root, name);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
}

const read = (root, name) => fs.readFileSync(path.join(root, name), "utf8");
const exists = (root, name) => fs.existsSync(path.join(root, name));
const template = (name) => fs.readFileSync(path.join(TEMPLATES, name), "utf8");

function run(root, ...args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: "utf8", env: GIT_ENV });
}

function git(root, ...args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", env: GIT_ENV });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function commitAll(root, message) {
  git(root, "add", "-A");
  git(root, "commit", "-q", "--no-verify", "-m", message);
  return git(root, "rev-parse", "HEAD");
}

function within(files, body) {
  const root = project(files);
  try {
    return body(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// ---- changes ----

test("changes with no commit holding the bank says to read the whole project", () => {
  within({ "src/a.js": "x\n" }, (root) => {
    const result = run(root, "changes");
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^bank commit: none, read the whole project$/mu);
  });
});

test("changes names the bank's last commit and lists only the files changed since", () => {
  within({ [`${MEMORY}/architecture.md`]: "# A\n", "src/kept.js": "x\n", "src/edited.js": "x\n" }, (root) => {
    git(root, "init", "-q");
    const base = commitAll(root, "bank");
    write(root, "src/edited.js", "y\n");
    commitAll(root, "code");
    const result = run(root, "changes");
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`^bank commit: ${base}$`, "mu"));
    assert.match(result.stdout, /^- src\/edited\.js$/mu);
    assert.doesNotMatch(result.stdout, /kept\.js/u);
  });
});

test("changes lists a file added since the bank's commit and not yet committed, never an ignored one", () => {
  within({ [`${MEMORY}/architecture.md`]: "# A\n", ".gitignore": "build/\n" }, (root) => {
    git(root, "init", "-q");
    commitAll(root, "bank");
    write(root, "src/new.js", "x\n");
    write(root, "build/out.js", "x\n");
    const result = run(root, "changes");
    assert.match(result.stdout, /^- src\/new\.js$/mu);
    assert.doesNotMatch(result.stdout, /build/u);
  });
});

test("changes names a folder misplaced in the bank, once however many files it holds", () => {
  within({ [`${MEMORY}/design/a.md`]: "# A\n", [`${MEMORY}/design/b.md`]: "# B\n", [`${MEMORY}/internal/c.md`]: "# C\n" }, (root) => {
    const result = run(root, "changes");
    assert.equal(result.stdout.match(/^misplaced folder: aidd_docs\/memory\/design\/$/gmu)?.length, 1, result.stdout);
    assert.doesNotMatch(result.stdout, /internal/u);
  });
});

test("changes never rewrites the git index, so it cannot race the person's own git", () => {
  within({ [`${MEMORY}/architecture.md`]: "# A\n", "src/a.js": "x\n" }, (root) => {
    git(root, "init", "-q");
    commitAll(root, "bank");
    // A touched file is stat-dirty: a git that may refresh the index rewrites it here.
    const later = new Date(Date.now() + 60_000);
    fs.utimesSync(path.join(root, "src/a.js"), later, later);
    const index = path.join(root, ".git/index");
    const before = fs.statSync(index).mtimeMs;
    run(root, "changes");
    assert.equal(fs.statSync(index).mtimeMs, before);
  });
});

// ---- scaffold ----

test("scaffold lays out an empty project: on-demand folders, the docs README, every always file and the named ones", () => {
  within({}, (root) => {
    const result = run(root, "scaffold", "api.md");
    assert.equal(result.status, 0, result.stderr);
    for (const dir of ["internal", "external"]) assert.equal(read(root, `${MEMORY}/${dir}/.gitkeep`), "");
    assert.equal(read(root, "aidd_docs/README.md"), template("README.md"));
    for (const file of [...ALWAYS, "api.md"]) {
      assert.equal(read(root, `${MEMORY}/${file}`), template(`memory/${file}`), file);
      assert.match(result.stdout, new RegExp(`^- ${MEMORY}/${file.replace(".", "\\.")}$`, "mu"), file);
    }
    assert.equal(exists(root, `${MEMORY}/backlog.md`), false, "an unnamed conditional file is not created");
  });
});

test("scaffold keeps what the team has: a file, one kept on demand, an accepted name, the docs README", () => {
  const files = {
    [`${MEMORY}/architecture.md`]: "# Ours\n",
    [`${MEMORY}/internal/vcs.md`]: "# VCS\n",
    [`${MEMORY}/integration.md`]: "# Integrations\n",
    [`${MEMORY}/external/infra.md`]: "# Infra\n",
    "aidd_docs/README.md": "# Team README\n",
  };
  within(files, (root) => {
    const result = run(root, "scaffold", "deployment.md");
    assert.equal(result.status, 0, result.stderr);
    for (const [name, text] of Object.entries(files)) assert.equal(read(root, name), text, name);
    for (const absent of ["vcs.md", "ecosystem.md", "deployment.md"]) assert.equal(exists(root, `${MEMORY}/${absent}`), false, absent);
    assert.equal(exists(root, `${MEMORY}/testing.md`), true);
  });
});

test("scaffold run twice creates nothing the second time and says so", () => {
  within({}, (root) => {
    run(root, "scaffold");
    const again = run(root, "scaffold");
    assert.equal(again.status, 0, again.stderr);
    assert.equal(again.stdout, "created: nothing\n");
  });
});

test("scaffold refuses a name with no template, and writes nothing", () => {
  within({}, (root) => {
    const result = run(root, "scaffold", "api.md", "glossary.md");
    assert.equal(result.status, 1);
    assert.equal(result.stderr, `project-memory.cjs scaffold: no template for glossary.md; known: ${require(SCRIPT).ROW_FILES.join(", ")}\n`);
    assert.equal(exists(root, "aidd_docs"), false);
  });
});

// ---- wire ----

test("wire creates an absent context file from the template, which carries the marker pair", () => {
  within({}, (root) => {
    const result = run(root, "wire", "claude");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(read(root, "CLAUDE.md"), template("AGENTS.md").replace(/^# AGENTS\.md$/mu, "# CLAUDE.md"));
    assert.equal(exists(root, "AGENTS.md"), false);
    assert.equal(exists(root, COPILOT), false, "copilot's file only when copilot is named");
  });
});

test("wire adds the marker pair once to a context file holding none, and keeps its content", () => {
  within({ "AGENTS.md": "# Team rules\n\n- Keep this.\n" }, (root) => {
    run(root, "wire", "codex", "cursor");
    run(root, "wire", "opencode");
    assert.equal(read(root, "AGENTS.md"), `# Team rules\n\n- Keep this.\n\n${OPEN}\n${CLOSE}\n`);
  });
});

test("wire leaves a context file holding a marker, legacy or broken, for the hooks to sync or report", () => {
  for (const text of [`# T\n\n${OPEN}\n${CLOSE}\n`, "# T\n\n<aidd_project_memory>\n</aidd_project_memory>\n", `# T\n\n${OPEN}\n`]) {
    within({ "CLAUDE.md": text }, (root) => {
      assert.equal(run(root, "wire", "claude").status, 0);
      assert.equal(read(root, "CLAUDE.md"), text);
    });
  }
});

test("wire maps antigravity to AGENTS.md", () => {
  within({}, (root) => {
    run(root, "wire", "antigravity");
    assert.equal(read(root, "AGENTS.md"), template("AGENTS.md"));
  });
});

test("wire refuses an unknown tool or no tool, and writes nothing", () => {
  within({}, (root) => {
    const unknown = run(root, "wire", "claude", "emacs");
    assert.equal(unknown.status, 1);
    assert.match(unknown.stderr, /unknown tool emacs/u);
    assert.equal(run(root, "wire").status, 1);
    assert.deepEqual(fs.readdirSync(root), []);
  });
});

test("wire of copilot fills AGENTS.md and creates copilot-instructions.md with the one pointer line", () => {
  within({}, (root) => {
    run(root, "wire", "copilot");
    assert.equal(read(root, "AGENTS.md"), template("AGENTS.md"));
    assert.equal(read(root, COPILOT), `${POINTER}\n`);
  });
});

test("wire of copilot keeps the team's copilot-instructions.md and adds the pointer once", () => {
  within({ [COPILOT]: "# Team\n\n- Keep this.\n" }, (root) => {
    run(root, "wire", "copilot");
    run(root, "wire", "copilot");
    assert.equal(read(root, COPILOT), `# Team\n\n- Keep this.\n\n${POINTER}\n`);
  });
});

test("wire of copilot leaves an old memory block for the session start to turn into the pointer", () => {
  const old = `# Team\n\n${OPEN}\n[a](../aidd_docs/memory/a.md)\n${CLOSE}\n`;
  within({ [COPILOT]: old }, (root) => {
    run(root, "wire", "copilot");
    assert.equal(read(root, COPILOT), old);
  });
});

test("wire of copilot never gives a pointer to a copilot file linked to AGENTS.md", () => {
  within({ "AGENTS.md": `# A\n\n${OPEN}\n${CLOSE}\n` }, (root) => {
    fs.mkdirSync(path.join(root, ".github"));
    fs.symlinkSync("../AGENTS.md", path.join(root, COPILOT));
    run(root, "wire", "copilot");
    assert.equal(read(root, "AGENTS.md"), `# A\n\n${OPEN}\n${CLOSE}\n`);
  });
});

test("wire of claude and codex through one linked file adds the pair once", () => {
  within({ "AGENTS.md": "# A\n" }, (root) => {
    fs.symlinkSync("AGENTS.md", path.join(root, "CLAUDE.md"));
    run(root, "wire", "claude", "codex");
    assert.equal(read(root, "AGENTS.md"), `# A\n\n${OPEN}\n${CLOSE}\n`);
  });
});

test("a context file wire created is one the hook's sync fills", () => {
  within({ [`${MEMORY}/architecture.md`]: "# A\n" }, (root) => {
    run(root, "wire", "codex");
    assert.deepEqual(require(HOOK).sync(root), []);
    assert.match(read(root, "AGENTS.md"), /^\[aidd_docs\/memory\/architecture\.md\]\(aidd_docs\/memory\/architecture\.md\)$/mu);
  });
});

// ---- check ----

/** A question of the named template, as a file holds it when nobody answered it. */
const unfilled = (name, index = 0) => `- ${[...template(`memory/${name}`).matchAll(/\{\{[^{}\n]*\}\}/gu)][index][0]}`;
const PLACEHOLDER = unfilled("vcs.md");
const LONG = `- ${Array(40).fill("word").join(" ")}.`;
const M3_AT = (file, line) => new RegExp(`^${MEMORY}/${file}:${line} M3 `, "mu");

test("check outside git lints every line of the bank's root files and fails on an error", () => {
  within({ [`${MEMORY}/vcs.md`]: `# VCS\n\n${PLACEHOLDER}\n` }, (root) => {
    const result = run(root, "check");
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /^check: 1 error, 0 warnings$/mu);
    assert.match(result.stdout, M3_AT("vcs.md", 3));
  });
});

test("check skips the lines the bank's last commit already held, so the team's own lines draw no finding", () => {
  within({ [`${MEMORY}/vcs.md`]: `# VCS\n\n${PLACEHOLDER}\n${LONG}\n` }, (root) => {
    git(root, "init", "-q");
    commitAll(root, "bank");
    write(root, `${MEMORY}/vcs.md`, `# VCS\n\n${PLACEHOLDER}\n${LONG}\n- One short new line.\n`);
    const result = run(root, "check");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "check: nothing to fix\n");
  });
});

test("check reports a line written since the bank's last commit, at its line", () => {
  within({ [`${MEMORY}/vcs.md`]: `# VCS\n\n${PLACEHOLDER}\n` }, (root) => {
    git(root, "init", "-q");
    commitAll(root, "bank");
    write(root, `${MEMORY}/vcs.md`, `# VCS\n\n${PLACEHOLDER}\n${unfilled("vcs.md", 1)}\n`);
    const result = run(root, "check");
    assert.equal(result.status, 1);
    assert.match(result.stdout, /^check: 1 error, 0 warnings$/mu);
    assert.match(result.stdout, M3_AT("vcs.md", 4));
  });
});

test("check lints every line of a bank file the last commit did not hold, and a bank never committed", () => {
  within({ [`${MEMORY}/vcs.md`]: "# VCS\n\n- Clean.\n", "src/a.js": "x\n" }, (root) => {
    git(root, "init", "-q");
    commitAll(root, "code only");
    git(root, "rm", "-q", "--cached", "-r", MEMORY);
    git(root, "commit", "-q", "--no-verify", "-m", "no bank");
    write(root, `${MEMORY}/api.md`, `# API\n\n${unfilled("api.md")}\n`);
    assert.match(run(root, "check").stdout, M3_AT("api.md", 3));
    commitAll(root, "bank");
    write(root, `${MEMORY}/cli.md`, `# CLI\n\n${unfilled("cli.md")}\n`);
    const result = run(root, "check");
    assert.match(result.stdout, M3_AT("cli.md", 3));
    assert.doesNotMatch(result.stdout, /api\.md/u);
  });
});

test("check leaves out an on-demand file", () => {
  within({ [`${MEMORY}/internal/notes.md`]: `# N\n\n${PLACEHOLDER}\n` }, (root) => {
    assert.equal(run(root, "check").stdout, "check: nothing to fix\n");
  });
});

test("check keeps a file over the word limit that a change made longer, though its title line was the team's", () => {
  const filler = Array.from({ length: 55 }, (_, index) => `- Fact ${index} holds eight plain words here.`).join("\n");
  within({ [`${MEMORY}/vcs.md`]: `# VCS\n\n${filler}\n` }, (root) => {
    git(root, "init", "-q");
    commitAll(root, "bank");
    write(root, `${MEMORY}/vcs.md`, `# VCS\n\n${filler}\n- One more fact holds eight plain words here.\n`);
    const result = run(root, "check");
    assert.equal(result.status, 0, "a warning alone does not fail");
    assert.match(result.stdout, /^aidd_docs\/memory\/vcs\.md:1 M6 warning /mu);
  });
});

test("an unknown subcommand prints the usage and fails", () => {
  within({}, (root) => {
    const result = run(root, "nope");
    assert.equal(result.status, 1);
    assert.equal(result.stderr, "usage: project-memory.cjs changes | scaffold [file...] | wire <tool...> | check\n");
  });
});

// ---- tables ----

const tableRows = (file) =>
  fs
    .readFileSync(path.join(SKILL, "references", file), "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("| `") || /^\| [a-z]+ \|/u.test(line))
    .map((line) => line.split("|").map((cell) => cell.trim()));
const namesIn = (cell) => [...cell.matchAll(/`([^`]+\.md)`/gu)].map((match) => match[1]);

test("the script's row files, always files and accepted names are the capability table's", () => {
  const { ROW_FILES, ALWAYS_WRITTEN, ACCEPTED_NAMES } = require(SCRIPT);
  const rows = tableRows("capabilities.md").filter((cells) => cells.length === 8);
  assert.deepEqual([...ROW_FILES].sort(), rows.flatMap((cells) => namesIn(cells[2])).sort());
  assert.deepEqual([...ALWAYS_WRITTEN].sort(), rows.filter((cells) => cells[5] === "yes").flatMap((cells) => namesIn(cells[2])).sort());
  const accepted = Object.fromEntries(rows.filter((cells) => namesIn(cells[6]).length > 0).map((cells) => [namesIn(cells[2])[0], namesIn(cells[6])]));
  assert.deepEqual(ACCEPTED_NAMES, accepted);
  for (const name of Object.values(accepted).flat()) assert.ok(!ROW_FILES.includes(name), `${name} is accepted and also a row file`);
});

test("the script's tool map is the tools table's", () => {
  const { TOOL_FILES } = require(SCRIPT);
  const rows = tableRows("tools.md").filter((cells) => cells.length === 5 && cells[1] !== "Tool");
  assert.deepEqual(TOOL_FILES, Object.fromEntries(rows.map((cells) => [cells[1], namesIn(cells[3])[0]])));
});

test("the script and the hook spell the markers and the copilot pointer alike", () => {
  const script = require(SCRIPT);
  const hook = require(HOOK);
  for (const name of ["BLOCK_OPEN", "BLOCK_CLOSE", "LEGACY_BLOCK_OPEN", "LEGACY_BLOCK_CLOSE", "COPILOT_FILE", "COPILOT_POINTER"]) {
    assert.equal(typeof script[name], "string", name);
    assert.equal(script[name], hook[name], name);
  }
});
