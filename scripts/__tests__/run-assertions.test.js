const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { describe, it, before, after } = require("node:test");

const SCRIPT = path.resolve(__dirname, "../../plugins/aidd-dev/skills/03-assert/scripts/run-assertions.cjs");

/**
 * A project is described by the commands of its "Before commit" table and the files around it.
 * Each rule has the one mutation that makes it fail, so a rule nothing fails for cannot stay.
 */

let root;

/** A git hook runs with GIT_DIR and GIT_INDEX_FILE set: a command that inherits them acts on the
 * repository being committed, not on the scratch one a test made for itself. */
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));

const git = (cwd, ...args) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd, encoding: "utf8", env: cleanEnv() });
const node = (code) => `node -e "${code}"`;
const PASSING = node("process.exit(0)");
const FAILING = node("console.error('bo'+'om'); process.exit(1)");

const assertionsMd = (commands, push = []) =>
  [
    "# Coding Assertions",
    "",
    "## Before commit",
    "",
    "| Order | Command | Checks |",
    "| ----- | ------- | ------ |",
    ...commands.map((c, i) => `| ${i + 1} | \`${c}\` | x |`),
    "",
    "## Before push",
    "",
    "| Order | Command | Checks |",
    "| ----- | ------- | ------ |",
    ...push.map((c, i) => `| ${i + 1} | \`${c}\` | x |`),
    "",
  ].join("\n");

function project(commands, { push = [], files = {}, markdown } = {}) {
  const dir = fs.mkdtempSync(path.join(root, "project-"));
  const all = { "src/a.js": "a", "tests/a.test.js": "t", "biome.json": "{}", "aidd_docs/tasks/2026_01/2026_01_02_t/plan.md": "p", ...files };
  for (const [name, content] of Object.entries(all)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), content);
  }
  if (markdown !== null) {
    fs.mkdirSync(path.join(dir, "aidd_docs/memory"), { recursive: true });
    fs.writeFileSync(path.join(dir, "aidd_docs/memory/coding-assertions.md"), markdown ?? assertionsMd(commands, push));
  }
  git(dir, "init", "-q", "-b", "main");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "setup", "--no-verify");
  return dir;
}

/** Runs on the project's task folder; a folder that is already one, or holds a project of its own, stands for itself. */
const run = (dir, ...extra) => {
  const folder = /aidd_docs\/tasks\//.test(dir) ? dir : path.join(dir, "aidd_docs/tasks/2026_01/2026_01_02_t");
  const r = spawnSync(process.execPath, [SCRIPT, folder, ...extra], { cwd: root, encoding: "utf8", env: cleanEnv() });
  return { out: r.stdout.trim(), code: r.status, first: r.stdout.split("\n")[0] };
};
const task = (dir) => path.join(dir, "aidd_docs/tasks/2026_01/2026_01_02_t");
const status = (dir) => git(dir, "status", "--porcelain").stdout.trim();

before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "run-assertions-"));
});
after(() => fs.rmSync(root, { recursive: true, force: true }));

describe("run-assertions", () => {
  it("says PASS when every command of the table passes", () => {
    const r = run(project([PASSING, PASSING]));
    assert.equal(r.first, "PASS");
    assert.equal(r.code, 0);
    assert.match(r.out, /^\| `.*` \| 0 \|$/m);
  });

  it("says FAIL with the exit code and the tail of a failing command", () => {
    const r = run(project([FAILING]));
    assert.equal(r.first, "FAIL");
    assert.equal(r.code, 1);
    assert.match(r.out, /^\| `.*` \| 1 \|$/m);
    assert.match(r.out, /### `.*`\n\n```text\nboom\n```/);
  });

  it("runs the commands after a failing one", () => {
    const dir = project([FAILING, node("require('fs').writeFileSync('second.txt','x')")]);
    run(dir);
    assert.ok(fs.existsSync(path.join(dir, "second.txt")));
  });

  it("runs the commands from the project folder", () => {
    const dir = project([node("require('fs').writeFileSync('here.txt','x')")]);
    run(dir);
    assert.ok(fs.existsSync(path.join(dir, "here.txt")));
  });

  it("ignores the commands under Before push", () => {
    assert.equal(run(project([PASSING], { push: [FAILING] })).first, "PASS");
  });

  it("lists a command that needs a commit message as SKIPPED, not FAIL", () => {
    const r = run(project([PASSING, "pnpm exec commitlint --edit"]));
    assert.equal(r.first, "PASS");
    assert.match(r.out, /\| `pnpm exec commitlint --edit` \| skipped \|/);
  });

  it("runs the table from the project that holds the task folder", () => {
    const dir = project([node("require('fs').writeFileSync('where.txt','x')")]);
    assert.equal(run(dir).first, "PASS");
    assert.ok(fs.existsSync(path.join(dir, "where.txt")));
  });

  it("takes the assertions closest to the folder", () => {
    const dir = project([PASSING]);
    fs.mkdirSync(path.join(dir, "sub/aidd_docs/memory"), { recursive: true });
    fs.writeFileSync(path.join(dir, "sub/aidd_docs/memory/coding-assertions.md"), assertionsMd([FAILING]));
    assert.equal(run(path.join(dir, "sub")).first, "FAIL");
  });

  it("asks for the checks from the manifest when the project has no assertions file", () => {
    const r = run(project([], { markdown: null }));
    assert.equal(r.first, "EMPTY");
    assert.equal(r.code, 2);
    assert.match(r.out, /NEXT: read the project's manifest .* after --/);
  });

  it("asks to read the assertions file when its table holds no command", () => {
    assert.match(run(project([], { markdown: "# Coding Assertions\n\nRun `make check`.\n" })).out, /NEXT: read .*coding-assertions\.md, then/);
  });

  it("asks for the checks when the table holds only the template placeholder", () => {
    assert.equal(run(project(["<command>"])).first, "EMPTY");
  });

  it("runs the commands given after -- in place of the table, one argument each", () => {
    const r = run(project([FAILING], { markdown: null }), "--", PASSING, PASSING);
    assert.equal(r.first, "PASS");
    assert.equal(r.out.match(/^\| `.*` \| 0 \|$/gm).length, 2);
  });

  it("names a table row it cannot run", () => {
    const markdown = `${assertionsMd([PASSING])}`.replace("## Before push", "| 2 | `pnpm test` then `pnpm lint` | x |\n\n## Before push");
    assert.match(run(project([], { markdown })).out, /- Not run, not a single command: `pnpm test` then `pnpm lint`/);
  });

  it("keeps a pipe in a command from splitting its row", () => {
    assert.match(run(project([], { markdown: null }), "--", `${PASSING} | cat`).out, /\\\| cat` \| 0 \|$/m);
  });

  it("finds the command of a table filled from the project-memory template", () => {
    const template = fs.readFileSync(path.resolve(__dirname, "../../plugins/aidd-context/skills/02-project-memory/assets/templates/memory/core/coding-assertions.md"), "utf8");
    assert.equal(run(project([], { markdown: template.replaceAll("<command>", PASSING) })).first, "PASS");
  });

  it("writes no file when it is given no task folder", () => {
    const dir = project([FAILING]);
    const r = spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: "utf8", env: cleanEnv() });
    assert.equal(r.stdout.split("\n")[0], "FAIL");
    assert.match(r.stdout, /## Round 1/);
    assert.doesNotMatch(r.stdout, /REPORT:/);
    assert.equal(status(dir), "");
  });

  it("creates a task folder that does not exist yet", () => {
    const dir = project([PASSING]);
    run(path.join(dir, "aidd_docs/tasks/2026_03/2026_03_04_new"));
    assert.ok(fs.existsSync(path.join(dir, "aidd_docs/tasks/2026_03/2026_03_04_new/assert.md")));
  });

  it("refuses a folder that is not a task folder, and runs nothing", () => {
    const dir = project([node("require('fs').writeFileSync('ran.txt','x')")]);
    for (const folder of ["aidd_docs/tasks", "src", "aidd_docs/tasks/2026_01/notes"]) {
      const r = spawnSync(process.execPath, [SCRIPT, path.join(dir, folder)], { encoding: "utf8", env: cleanEnv() });
      assert.equal(r.stdout.split("\n")[0], "STOP", folder);
      assert.equal(r.status, 3, folder);
    }
    assert.equal(status(dir), "");
  });

  it("refuses the task folder of a folder that holds no assertions of its own", () => {
    const dir = project([PASSING]);
    const r = spawnSync(process.execPath, [SCRIPT, path.join(dir, "sub/aidd_docs/tasks/2026_01/2026_01_02_t")], { encoding: "utf8", env: cleanEnv() });
    assert.equal(r.stdout.split("\n")[0], "STOP");
  });

  it("takes the task folder of a nested project, and its assertions", () => {
    const dir = project([PASSING]);
    fs.mkdirSync(path.join(dir, "sub/aidd_docs/memory"), { recursive: true });
    fs.writeFileSync(path.join(dir, "sub/aidd_docs/memory/coding-assertions.md"), assertionsMd([FAILING]));
    assert.equal(run(path.join(dir, "sub/aidd_docs/tasks/2026_01/2026_01_02_t")).first, "FAIL");
  });

  it("runs the given commands from the repository root, not from the task folder", () => {
    const dir = project([], { markdown: null });
    run(task(dir), "--", node("require('fs').writeFileSync('here.txt','x')"));
    assert.ok(fs.existsSync(path.join(dir, "here.txt")));
  });

  describe("the report", () => {
    const report = (dir) => path.join(task(dir), "assert.md");

    it("appends to the task folder's assert.md the round it prints", () => {
      const dir = project([FAILING]);
      const r = run(task(dir));
      const round = r.out.split("\n").slice(1, -1).join("\n").trim();
      assert.equal(fs.readFileSync(report(dir), "utf8").trim(), `# Assert\n\n${round}`);
      assert.match(round, /^## Round 1\n/);
      assert.ok(r.out.endsWith(`REPORT: ${report(dir)}`));
    });

    it("keeps every earlier round and numbers the next one after them", () => {
      const dir = project([FAILING]);
      run(task(dir));
      fs.writeFileSync(path.join(dir, "aidd_docs/memory/coding-assertions.md"), assertionsMd([PASSING]));
      run(task(dir));
      const text = fs.readFileSync(report(dir), "utf8");
      assert.match(text, /## Round 1\n[^]*- Verdict: FAIL[^]*## Round 2\n[^]*- Verdict: PASS/);
      assert.equal(text.match(/^# Assert$/gm).length, 1);
    });

    it("reads the tree before a check writes to it", () => {
      const dir = project([node("require('fs').writeFileSync('out.txt','x')")]);
      assert.doesNotMatch(run(task(dir)).out, /uncommitted/);
    });

    it("changes nothing in the work but the report", () => {
      const dir = project([FAILING]);
      run(task(dir));
      assert.equal(status(dir), "?? aidd_docs/tasks/2026_01/2026_01_02_t/assert.md");
    });

    it("names the commit judged, and the uncommitted changes judged with it", () => {
      const dir = project([PASSING]);
      const head = git(dir, "rev-parse", "--short", "HEAD").stdout.trim();
      run(task(dir));
      assert.match(run(task(dir)).out, new RegExp(`- Head: \`${head}\`$`, "m"));
      fs.writeFileSync(path.join(dir, "src/a.js"), "changed");
      assert.match(run(task(dir)).out, new RegExp(`- Head: \`${head}\` plus uncommitted changes`));
    });
  });
});
