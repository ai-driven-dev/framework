const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const REPO_ROOT = path.resolve(__dirname, "../..");
const HOOK = path.join(REPO_ROOT, ".claude/hooks/check-architecture-rules.js");

const CLEAN_SKILL = [
  "# Clean skill",
  "",
  "## Actions",
  "",
  "| # | Action | Role |",
  "| --- | --- | --- |",
  "| 01 | `step` | Do the one thing |",
  "",
].join("\n");

const SIBLING_ADDRESS_SKILL = [
  "# Clean skill",
  "",
  "See @aidd-fixture-b:02-thing for the other half.",
  "",
  "## Actions",
  "",
  "| # | Action | Role |",
  "| --- | --- | --- |",
  "| 01 | `step` | Do the one thing |",
  "",
].join("\n");

/** A fresh temp tree with a `plugins/` root, so the hook's own file classifier applies to it
 * exactly as it would to this repository, without touching this repository's tracked files. */
function makeProjectDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "architecture-hook-test-"));
  return dir;
}

function writeFixtureFile(projectDir, relPath, content) {
  const abs = path.join(projectDir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf8");
  return abs;
}

function runHook(projectDir, payload) {
  const input = typeof payload === "string" ? payload : JSON.stringify(payload);
  const result = spawnSync(process.execPath, [HOOK], {
    input,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    cwd: projectDir,
  });
  return result;
}

function parseDenyReason(stdout) {
  const parsed = JSON.parse(stdout);
  return parsed.hookSpecificOutput.permissionDecisionReason;
}

test("a clean Write over a plugin skill exits zero with no output", () => {
  const projectDir = makeProjectDir();
  const filePath = path.join(projectDir, "plugins/aidd-fixture-a/skills/01-clean/SKILL.md");

  const result = runHook(projectDir, {
    tool_name: "Write",
    tool_input: { file_path: filePath, content: CLEAN_SKILL },
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
});

test("a Write introducing a sibling address is denied, naming file, line and owning plugin", () => {
  const projectDir = makeProjectDir();
  const filePath = path.join(projectDir, "plugins/aidd-fixture-a/skills/01-clean/SKILL.md");

  const result = runHook(projectDir, {
    tool_name: "Write",
    tool_input: { file_path: filePath, content: SIBLING_ADDRESS_SKILL },
  });

  assert.equal(result.status, 0);
  const reason = parseDenyReason(result.stdout);
  assert.match(reason, /plugins\/aidd-fixture-a\/skills\/01-clean\/SKILL\.md:3/);
  assert.match(reason, /aidd-fixture-b/);
});

test("an Edit reconstructing the same content as the denied Write yields the same verdict", () => {
  const projectDir = makeProjectDir();
  const filePath = writeFixtureFile(
    projectDir,
    "plugins/aidd-fixture-a/skills/01-clean/SKILL.md",
    CLEAN_SKILL
  );

  const result = runHook(projectDir, {
    tool_name: "Edit",
    tool_input: {
      file_path: filePath,
      old_string: "# Clean skill\n",
      new_string: "# Clean skill\n\nSee @aidd-fixture-b:02-thing for the other half.\n",
    },
  });

  assert.equal(result.status, 0);
  const writeResult = runHook(projectDir, {
    tool_name: "Write",
    tool_input: { file_path: filePath, content: SIBLING_ADDRESS_SKILL },
  });
  const editReason = parseDenyReason(result.stdout);
  const writeReason = parseDenyReason(writeResult.stdout);
  assert.equal(editReason, writeReason);
});

test("an Edit whose old_string is absent from the current file exits zero", () => {
  const projectDir = makeProjectDir();
  const filePath = writeFixtureFile(
    projectDir,
    "plugins/aidd-fixture-a/skills/01-clean/SKILL.md",
    CLEAN_SKILL
  );

  const result = runHook(projectDir, {
    tool_name: "Edit",
    tool_input: {
      file_path: filePath,
      old_string: "this text is not in the file",
      new_string: "See @aidd-fixture-b:02-thing for the other half.",
    },
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
});

test("a path under assets/ exits zero even when its content addresses a sibling", () => {
  const projectDir = makeProjectDir();
  const filePath = path.join(
    projectDir,
    "plugins/aidd-fixture-a/skills/01-clean/assets/notes.md"
  );

  const result = runHook(projectDir, {
    tool_name: "Write",
    tool_input: { file_path: filePath, content: SIBLING_ADDRESS_SKILL },
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
});

test("a malformed payload exits zero with no output", () => {
  const projectDir = makeProjectDir();

  const result = runHook(projectDir, "{ not json at all");

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
});

test("a path outside plugins/ exits zero even when its content addresses a sibling", () => {
  const projectDir = makeProjectDir();
  const filePath = path.join(projectDir, "README.md");

  const result = runHook(projectDir, {
    tool_name: "Write",
    tool_input: { file_path: filePath, content: SIBLING_ADDRESS_SKILL },
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
});

test("an agent's permission list naming a sibling canonically is applied with no complaint", () => {
  const projectDir = makeProjectDir();
  const filePath = path.join(projectDir, "plugins/aidd-fixture-a/agents/thing.md");
  const content = [
    "# Thing",
    "",
    "# Skills you may invoke",
    "",
    "- `/aidd-fixture-b:02-thing`",
    "",
  ].join("\n");

  const result = runHook(projectDir, {
    tool_name: "Write",
    tool_input: { file_path: filePath, content },
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
});

test("an Edit with replace_all denies on both occurrences the reconstruction introduces", () => {
  const projectDir = makeProjectDir();
  const twoAnchors = [
    "# Clean skill",
    "",
    "ANCHOR",
    "",
    "ANCHOR",
    "",
    "## Actions",
    "",
    "| # | Action | Role |",
    "| --- | --- | --- |",
    "| 01 | `step` | Do the one thing |",
    "",
  ].join("\n");
  const filePath = writeFixtureFile(
    projectDir,
    "plugins/aidd-fixture-a/skills/01-clean/SKILL.md",
    twoAnchors
  );

  const result = runHook(projectDir, {
    tool_name: "Edit",
    tool_input: {
      file_path: filePath,
      old_string: "ANCHOR",
      new_string: "See @aidd-fixture-b:02-thing here.",
      replace_all: true,
    },
  });

  assert.equal(result.status, 0);
  const reason = parseDenyReason(result.stdout);
  assert.match(reason, /:3\b/);
  assert.match(reason, /:5\b/);
});

test("a MultiEdit that introduces a sibling address is denied", () => {
  const projectDir = makeProjectDir();
  const rel = "plugins/aidd-fixture-a/skills/01-clean/SKILL.md";
  const filePath = writeFixtureFile(projectDir, rel, CLEAN_SKILL);

  const result = runHook(projectDir, {
    tool_name: "MultiEdit",
    tool_input: {
      file_path: filePath,
      edits: [
        { old_string: "# Clean skill", new_string: "# Clean skill\n\nstill clean here" },
        { old_string: "still clean here", new_string: "See @aidd-fixture-b:02-thing for the other half." },
      ],
    },
  });

  assert.equal(result.status, 0);
  const reason = parseDenyReason(result.stdout);
  assert.match(reason, /aidd-fixture-b/);
  assert.match(reason, new RegExp(`${rel}:3`));
});

test("a MultiEdit whose edits stay clean exits zero with no output", () => {
  const projectDir = makeProjectDir();
  const rel = "plugins/aidd-fixture-a/skills/01-clean/SKILL.md";
  const filePath = writeFixtureFile(projectDir, rel, CLEAN_SKILL);

  const result = runHook(projectDir, {
    tool_name: "MultiEdit",
    tool_input: {
      file_path: filePath,
      edits: [{ old_string: "# Clean skill", new_string: "# Still a clean skill" }],
    },
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
});

test("a MultiEdit whose first edit cannot be applied exits zero", () => {
  const projectDir = makeProjectDir();
  const rel = "plugins/aidd-fixture-a/skills/01-clean/SKILL.md";
  const filePath = writeFixtureFile(projectDir, rel, CLEAN_SKILL);

  const result = runHook(projectDir, {
    tool_name: "MultiEdit",
    tool_input: {
      file_path: filePath,
      edits: [
        { old_string: "a string this file never holds", new_string: "@aidd-fixture-b:02-thing" },
      ],
    },
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
});
