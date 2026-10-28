const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { describe, it, before, after } = require("node:test");

const SCRIPT = path.resolve(__dirname, "../../plugins/aidd-dev/skills/02-implement/scripts/validate-implement.cjs");

/**
 * A plan folder is described by the plan's status and, per phase, its status and `Depends on`.
 * Each rule has the one mutation that makes it fail, so a rule nothing fails for cannot stay.
 */

let root;

/** A git hook runs with GIT_DIR and GIT_INDEX_FILE set: a command that inherits them acts on the
 * repository being committed, not on the scratch one a test made for itself. */
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));

const planMd = (status, phases) =>
  [
    "---",
    'objective: "x"',
    `status: ${status}`,
    "---",
    "",
    "# Plan: x",
    "",
    "## Phases",
    "",
    "| #   | Phase | File | Depends on |",
    "| --- | ----- | ---- | ---------- |",
    ...phases.map((p, i) => `| ${i + 1} | x | [\`phase-${i + 1}.md\`](./phase-${i + 1}.md) | ${p.deps ?? "none"} |`),
    "",
    "## Impact",
    "",
  ].join("\n");

const taskHeadings = (tasks) => Array.from({ length: tasks }, (_, i) => `\n### \`${i + 1})\` task ${i + 1}\n`).join("");
const phaseMd = (status, tasks = 0) => `---\nstatus: ${status}\n---\n\n# Instruction: x\n${taskHeadings(tasks)}`;

const runMd = (number = 1, head = "abc1234", rows = ["| 1.1 | pnpm test | 80 passed |"]) =>
  `## Run ${number}\n\nHead: ${head}\n\n| Task | Validation | Result |\n| ---- | ---------- | ------ |\n${rows.join("\n")}\n\nLeft: none\n`;
const RUN_MD = `# Run\n\n${runMd()}`;

function withoutComments(text) {
  let out = "";
  for (let i = 0; i < text.length; ) {
    const open = text.indexOf("<!--", i);
    if (open < 0) return out + text.slice(i);
    out += text.slice(i, open);
    const close = text.indexOf("-->", open);
    i = close < 0 ? text.length : close + 3;
    while (text[i] === "\n") i += 1;
  }
  return out;
}
const RUN_TEMPLATE = path.resolve(__dirname, "../../plugins/aidd-dev/skills/02-implement/assets/run-template.md");

function folder(plan, phases, { crlf = false, runs = plan === "implemented" ? RUN_MD : null, into = root } = {}) {
  const dir = fs.mkdtempSync(path.join(into, "plan-"));
  const eol = (s) => (crlf ? s.replace(/\n/g, "\r\n") : s);
  fs.writeFileSync(path.join(dir, "plan.md"), eol(planMd(plan, phases)));
  if (runs !== null) fs.writeFileSync(path.join(dir, "run.md"), eol(runs));
  phases.forEach((p, i) => fs.writeFileSync(path.join(dir, `phase-${i + 1}.md`), eol(phaseMd(p.status, p.tasks))));
  return dir;
}

function run(dir, ...flags) {
  const r = spawnSync(process.execPath, [SCRIPT, dir, ...flags], { encoding: "utf8", env: cleanEnv() });
  return { out: r.stdout.trim(), code: r.status };
}

before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "validate-implement-"));
});
after(() => fs.rmSync(root, { recursive: true, force: true }));

describe("validate-implement", () => {
  it("accepts a plan midway: done, then in progress on what it needed", () => {
    const r = run(folder("in-progress", [{ status: "done" }, { status: "in-progress", deps: "1" }]));
    assert.match(r.out, /^OK(\n|$)/);
  });

  it("accepts an implemented plan with every phase done", () => {
    assert.match(run(folder("implemented", [{ status: "done" }, { status: "done", deps: "1" }])).out, /^OK$/);
  });

  it("accepts a blocked plan whatever its phases hold", () => {
    assert.match(run(folder("blocked", [{ status: "done" }, { status: "in-progress", deps: "1" }])).out, /^OK$/);
  });

  it("accepts the same plan saved with Windows line endings", () => {
    const r = run(folder("in-progress", [{ status: "done" }, { status: "in-progress", deps: "1" }], { crlf: true }));
    assert.match(r.out, /^OK(\n|$)/);
  });

  it("refuses a plan status outside the lifecycle", () => {
    const r = run(folder("done", [{ status: "pending" }]));
    assert.equal(r.code, 1);
    assert.match(r.out, /plan\.md: status "done" must be pending, in-progress, implemented, or blocked/);
  });

  it("refuses a phase status outside the lifecycle", () => {
    const r = run(folder("in-progress", [{ status: "implemented" }]));
    assert.match(r.out, /phase-1\.md: status "implemented" must be pending, in-progress, or done/);
  });

  it("refuses a pending plan whose phase has moved", () => {
    const r = run(folder("pending", [{ status: "in-progress" }]));
    assert.match(r.out, /plan\.md: status pending but phase 1 is in-progress/);
  });

  it("refuses an implemented plan with a phase not done", () => {
    const r = run(folder("implemented", [{ status: "done" }, { status: "in-progress", deps: "1" }]));
    assert.match(r.out, /plan\.md: status implemented but phase 2 is in-progress/);
  });

  it("refuses two phases in progress at once", () => {
    const r = run(folder("in-progress", [{ status: "in-progress" }, { status: "in-progress" }]));
    assert.match(r.out, /phases 1, 2 are in-progress together/);
  });

  it("refuses a phase in progress together with the phase it depends on", () => {
    const r = run(folder("in-progress", [{ status: "in-progress" }, { status: "in-progress", deps: "1" }]));
    assert.match(r.out, /phase 2 is in-progress but depends on phase 1 \(in-progress\)/);
  });

  it("refuses an implemented plan with no run recorded", () => {
    const r = run(folder("implemented", [{ status: "done" }], { runs: null }));
    assert.match(r.out, /^STATE\nrun\.md: no "## Run" recorded, append one$/);
  });

  it("refuses an implemented plan whose run file holds no run", () => {
    const r = run(folder("implemented", [{ status: "done" }], { runs: "# Run\n" }));
    assert.match(r.out, /run\.md: no "## Run" recorded/);
  });

  it("asks for no run before the plan is implemented", () => {
    assert.match(run(folder("in-progress", [{ status: "in-progress" }])).out, /^OK(\n|$)/);
  });

  it("refuses a phase started before what it depends on is done", () => {
    const r = run(folder("in-progress", [{ status: "in-progress" }, { status: "pending", deps: "1" }, { status: "done", deps: "1, 2" }]));
    assert.match(r.out, /phase 3 is done but depends on phase 2 \(pending\)/);
  });

  it("lets a blocked plan stop with phases half done, in progress together", () => {
    const r = run(folder("blocked", [{ status: "in-progress" }, { status: "in-progress" }]));
    assert.match(r.out, /^OK(\n|$)/);
  });

  it("lets a blocked plan stop in a phase whose dependency is not done", () => {
    const r = run(folder("blocked", [{ status: "pending" }, { status: "in-progress", deps: "1" }]));
    assert.match(r.out, /^OK(\n|$)/);
  });

  it("reads the front matter of a phase with no status as pending", () => {
    const dir = folder("pending", [{ status: "pending" }]);
    fs.writeFileSync(path.join(dir, "phase-1.md"), "# Instruction: x\n");
    assert.match(run(dir).out, /phase-1\.md: front matter key "status" missing/);
  });
});

const git = (dir, ...args) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "core.hooksPath=/dev/null", "-C", dir, ...args], { encoding: "utf8", env: cleanEnv() });

/** The plan commit first, then the run that names it as its head, as a real pass records it. */
function commitWithRun(dir) {
  git(dir, "init", "-q");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "plan");
  const head = git(dir, "rev-parse", "HEAD").stdout.trim();
  fs.writeFileSync(path.join(dir, "run.md"), `# Run\n\n${runMd(1, head)}`);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "run");
  return dir;
}

describe("validate-implement: uncommitted files once the plan is closed", () => {

  function repo(plan, phases) {
    return commitWithRun(folder(plan, phases, { runs: null }));
  }

  it("prints only OK when a closed plan leaves nothing uncommitted", () => {
    const r = run(repo("implemented", [{ status: "done" }]));
    assert.match(r.out, /^OK(\n|$)/);
    assert.equal(r.code, 0);
  });

  it("names the uncommitted files after OK when a plan is implemented", () => {
    const dir = repo("implemented", [{ status: "done" }]);
    fs.writeFileSync(path.join(dir, "left-behind.txt"), "x");
    const r = run(dir);
    assert.equal(r.out.split("\n")[0], "OK");
    assert.match(r.out, /NOTE uncommitted files \(1\): left-behind\.txt/);
    assert.equal(r.code, 0);
  });

  it("names them when a plan is blocked", () => {
    const dir = repo("blocked", [{ status: "in-progress" }]);
    fs.writeFileSync(path.join(dir, "left-behind.txt"), "x");
    assert.match(run(dir).out, /NOTE uncommitted files \(1\): left-behind\.txt/);
  });

  it("prints only OK outside a git repository", () => {
    assert.match(run(folder("implemented", [{ status: "done" }])).out, /^OK(\n|$)/);
  });
});

describe("validate-implement: files and folders as real machines write them", () => {
  it("works on a folder whose path holds spaces and is given with a trailing separator", () => {
    const parent = fs.mkdtempSync(path.join(root, "with space-"));
    const dir = path.join(parent, "my feature");
    fs.mkdirSync(dir);
    const src = folder("in-progress", [{ status: "in-progress" }]);
    for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dir, f));
    assert.match(run(dir + path.sep).out, /^OK(\n|$)/);
  });

  it("says what to pass when no folder is given", () => {
    const r = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8", env: cleanEnv() });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^STATE\nusage: node validate-implement\.cjs <feature-folder>/);
  });

  it("says the plan is missing when the folder does not exist", () => {
    const r = run(path.join(root, "no-such-folder"));
    assert.equal(r.code, 1);
    assert.match(r.out, /plan\.md: missing/);
  });

  it("reports a listed phase whose file is absent as nothing to check, validate-plan owns that", () => {
    const dir = folder("in-progress", [{ status: "in-progress" }, { status: "pending", deps: "1" }]);
    fs.rmSync(path.join(dir, "phase-2.md"));
    assert.match(run(dir).out, /^OK(\n|$)/);
  });
});

describe("validate-implement: the uncommitted files it names", () => {
  function closedRepo() {
    const dir = folder("implemented", [{ status: "done" }], { runs: null });
    return commitWithRun(dir);
  }

  it("names a file whose name holds spaces without quoting it", () => {
    const dir = closedRepo();
    fs.writeFileSync(path.join(dir, "my notes.txt"), "x");
    assert.match(run(dir).out, /NOTE uncommitted files \(1\): my notes\.txt$/m);
  });

  it("names every untracked file of a new folder, not the folder", () => {
    const dir = closedRepo();
    fs.mkdirSync(path.join(dir, "src"));
    fs.writeFileSync(path.join(dir, "src", "a.txt"), "x");
    fs.writeFileSync(path.join(dir, "src", "b.txt"), "x");
    assert.match(run(dir).out, /NOTE uncommitted files \(2\): src\/a\.txt, src\/b\.txt$/m);
  });

  it("names the new path of a renamed file once", () => {
    const dir = closedRepo();
    fs.writeFileSync(path.join(dir, "old.txt"), "x");
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "y");
    git(dir, "mv", "old.txt", "new.txt");
    assert.match(run(dir).out, /NOTE uncommitted files \(1\): new\.txt$/m);
  });

  it("names at most five files and says how many there are", () => {
    const dir = closedRepo();
    for (let i = 1; i <= 7; i++) fs.writeFileSync(path.join(dir, `f${i}.txt`), "x");
    const note = run(dir).out.split("\n")[1];
    assert.match(note, /^NOTE uncommitted files \(7\): f1\.txt, f2\.txt, f3\.txt, f4\.txt, f5\.txt$/);
  });

});

describe("validate-implement: what a run records", () => {
  const closedWith = (text) => run(folder("implemented", [{ status: "done" }], { runs: text }));
  const filledTemplate = () =>
    withoutComments(fs.readFileSync(RUN_TEMPLATE, "utf8"))
      .replace("{{number}}", "1")
      .replace("{{sha of HEAD when the validations ran}}", "abc1234")
      .replace("{{phase.task, such as 1.2}}", "1.1").replace("{{scenario of that task's criterion, and the command that ran it}}", "pnpm test")
      .replace("{{observable outcome}}", "80 passed")
      .replace(/\{\{undone[^}]*\}\}/, "none");

  it("accepts a run filled from the template", () => {
    assert.match(closedWith(filledTemplate()).out, /^OK(\n|$)/);
  });

  it("refuses the template as it stands", () => {
    assert.match(closedWith(fs.readFileSync(RUN_TEMPLATE, "utf8")).out, /run\.md: placeholder or comment left/);
  });

  it("accepts several runs numbered in order", () => {
    assert.match(closedWith(`# Run\n\n${runMd(1)}\n${runMd(2)}`).out, /^OK(\n|$)/);
  });

  it("refuses a run that names no head", () => {
    assert.match(closedWith(`# Run\n\n${runMd(1).replace("Head: abc1234\n", "")}`).out, /run 1: "Head:" needs a commit sha/);
  });

  it("refuses a head that is not a sha", () => {
    assert.match(closedWith(`# Run\n\n${runMd(1, "latest")}`).out, /run 1: "Head:" needs a commit sha/);
  });

  it("refuses a head that is no commit of the repository", () => {
    const dir = commitWithRun(folder("implemented", [{ status: "done" }], { runs: null }));
    fs.writeFileSync(path.join(dir, "run.md"), `# Run\n\n${runMd(1, "deadbeef")}`);
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "wrong head");
    assert.match(run(dir).out, /run 1: head deadbeef is not a commit/);
  });

  it("refuses a run with no validation row", () => {
    const empty = runMd(1, "abc1234", []);
    assert.match(closedWith(`# Run\n\n${empty}`).out, /run 1: needs a "Task \| Validation \| Result" table with a row/);
  });

  it("refuses a validation row left empty", () => {
    const empty = runMd(1, "abc1234", ["| 1.1 | pnpm test |  |"]);
    assert.match(closedWith(`# Run\n\n${empty}`).out, /run 1: needs a "Task \| Validation \| Result" table with a row/);
  });

  it("refuses a run that does not say what is left", () => {
    assert.match(closedWith(`# Run\n\n${runMd(1).replace("Left: none\n", "")}`).out, /run 1: "Left:" missing/);
  });

  it("refuses a comment left in the run file", () => {
    assert.match(closedWith(`# Run\n\n<!-- note -->\n${runMd(1)}`).out, /run\.md: placeholder or comment left/);
  });
});

describe("validate-implement: what it says comes next", () => {
  const next = (plan, phases) => run(folder(plan, phases)).out.split("\n").find((line) => line.startsWith("NEXT:"));

  it("names the ready phase when none is running", () => {
    assert.equal(next("in-progress", [{ status: "done" }, { status: "pending", deps: "1" }]), "NEXT: take phase 2");
  });

  it("names the phase in progress and what to do in it", () => {
    assert.equal(next("in-progress", [{ status: "in-progress" }]), "NEXT: phase 1 is in progress: build its next task, or close it");
  });

  it("sends to the last action once every phase is done", () => {
    assert.equal(next("in-progress", [{ status: "done" }, { status: "done", deps: "1" }]), "NEXT: every phase is done: read actions/03-finalize.md");
  });

  it("names the first ready phase when several are ready", () => {
    assert.equal(next("in-progress", [{ status: "pending" }, { status: "pending" }]), "NEXT: take phase 1");
  });

  it("starts with the plan status when the plan is still pending", () => {
    assert.equal(next("pending", [{ status: "pending" }]), "NEXT: mark the plan in-progress, then take phase 1");
  });

  it("skips a pending phase whose dependency is not done", () => {
    assert.equal(next("in-progress", [{ status: "in-progress" }, { status: "pending", deps: "1" }]), "NEXT: phase 1 is in progress: build its next task, or close it");
  });

  it("says no phase is ready when every pending phase waits on one that is not done", () => {
    assert.equal(next("in-progress", [{ status: "pending", deps: "2" }, { status: "pending", deps: "1" }]), "NEXT: no phase is ready, stop and ask");
  });

  it("says nothing once the plan is implemented or blocked", () => {
    assert.equal(next("implemented", [{ status: "done" }]), undefined);
    assert.equal(next("blocked", [{ status: "in-progress" }]), undefined);
  });

});

describe("validate-implement: a run covers every task of the plan", () => {
  const withTasks = (rows, tasks = [2, 1]) => {
    const dir = folder("implemented", tasks.map(() => ({ status: "done" })), { runs: `# Run\n\n${runMd(1, "abc1234", rows)}` });
    tasks.forEach((count, i) => fs.writeFileSync(path.join(dir, `phase-${i + 1}.md`), phaseMd("done", count)));
    return run(dir);
  };
  const row = (task) => `| ${task} | pnpm test | passed |`;

  it("names a task the run has no row for", () => {
    assert.match(withTasks([row("1.1"), row("2.1")]).out, /run\.md: run 1 has no row for task 1\.2/);
  });

  it("names every missing task", () => {
    assert.match(withTasks([row("1.1")]).out, /task 1\.2[\s\S]*task 2\.1/);
  });

  it("asks nothing of a phase that lists no task", () => {
    assert.match(withTasks([row("1.1")], [1, 0]).out, /^OK(\n|$)/);
  });

  it("reads the last run alone: an earlier one may cover less", () => {
    const dir = folder("implemented", [{ status: "done" }], { runs: `# Run\n\n${runMd(1, "abc1234", [row("1.1")])}\n${runMd(2, "abc1234", [row("1.1"), row("1.2")])}` });
    fs.writeFileSync(path.join(dir, "phase-1.md"), phaseMd("done", 2));
    assert.match(run(dir).out, /^OK(\n|$)/);
  });

  it("refuses a last run that covers less than the plan", () => {
    const dir = folder("implemented", [{ status: "done" }], { runs: `# Run\n\n${runMd(1, "abc1234", [row("1.1"), row("1.2")])}\n${runMd(2, "abc1234", [row("1.1")])}` });
    fs.writeFileSync(path.join(dir, "phase-1.md"), phaseMd("done", 2));
    assert.match(run(dir).out, /run 2 has no row for task 1\.2/);
  });
});

describe("validate-implement: files modified before the start", () => {
  /** A repository holding the plan in a sub-folder, with README.md edited and not committed. */
  function startedRepo({ planFolderDirty = false } = {}) {
    const repoDir = fs.mkdtempSync(path.join(root, "repo-"));
    fs.writeFileSync(path.join(repoDir, "README.md"), "a\n");
    fs.writeFileSync(path.join(repoDir, "code.txt"), "a\n");
    git(repoDir, "init", "-q");
    git(repoDir, "add", "-A");
    git(repoDir, "commit", "-q", "-m", "start");
    const dir = folder("pending", [{ status: "pending" }], { into: repoDir });
    if (!planFolderDirty) {
      git(repoDir, "add", "-A");
      git(repoDir, "commit", "-q", "-m", "plan");
    }
    fs.writeFileSync(path.join(repoDir, "README.md"), "edited by the user\n");
    return { repoDir, dir };
  }
  const commitFiles = (repoDir, ...files) => {
    files.forEach((file) => git(repoDir, "add", file));
    git(repoDir, "commit", "-q", "-m", "work");
  };

  it("records the files already modified and says which", () => {
    const { dir } = startedRepo();
    const r = run(dir, "--baseline");
    assert.match(r.out, /^OK\nNOTE already modified \(1\): README\.md$/);
    assert.equal(r.code, 0);
  });

  it("accepts a commit that leaves those files out", () => {
    const { repoDir, dir } = startedRepo();
    run(dir, "--baseline");
    fs.writeFileSync(path.join(repoDir, "code.txt"), "b\n");
    commitFiles(repoDir, "code.txt");
    assert.match(run(dir).out, /^OK(\n|$)/);
  });

  it("refuses a commit that holds one of them, and says how to undo it", () => {
    const { repoDir, dir } = startedRepo();
    run(dir, "--baseline");
    fs.writeFileSync(path.join(repoDir, "code.txt"), "b\n");
    commitFiles(repoDir, "code.txt", "README.md");
    const sha = git(repoDir, "rev-parse", "--short", "HEAD").stdout.trim();
    const r = run(dir);
    assert.match(r.out, new RegExp(`README\\.md: modified before the start, yet committed in ${sha}: undo that commit \\(git reset --soft ${sha}~1\\) and commit again without it`));
    assert.equal(r.code, 1);
  });

  it("leaves alone the repository a git hook names, as a commit does with GIT_DIR and GIT_INDEX_FILE", () => {
    const decoy = fs.mkdtempSync(path.join(root, "decoy-"));
    git(decoy, "init", "-q");
    fs.writeFileSync(path.join(decoy, "kept.txt"), "x\n");
    git(decoy, "add", "-A");
    git(decoy, "commit", "-q", "-m", "decoy");
    const before = git(decoy, "rev-parse", "HEAD").stdout.trim();
    process.env.GIT_DIR = path.join(decoy, ".git");
    process.env.GIT_INDEX_FILE = path.join(decoy, ".git", "index");
    try {
      const { repoDir, dir } = startedRepo();
      run(dir, "--baseline");
      commitFiles(repoDir, "README.md");
      run(dir);
    } finally {
      delete process.env.GIT_DIR;
      delete process.env.GIT_INDEX_FILE;
    }
    assert.equal(git(decoy, "rev-parse", "HEAD").stdout.trim(), before);
    assert.equal(git(decoy, "rev-list", "--count", "HEAD").stdout.trim(), "1");
  });

  it("takes the folder wherever it stands among the arguments, and ignores a flag it does not know", () => {
    const { dir } = startedRepo();
    const r = spawnSync(process.execPath, [SCRIPT, "--baseline", "--plan", dir], { encoding: "utf8", env: cleanEnv() });
    assert.match(r.stdout.trim(), /^OK\nNOTE already modified \(1\): README\.md$/);
  });

  it("keeps the baseline once the plan has started: a later call cannot take the work for the past", () => {
    const { repoDir, dir } = startedRepo();
    run(dir, "--baseline");
    const planFile = path.join(dir, "plan.md");
    fs.writeFileSync(planFile, fs.readFileSync(planFile, "utf8").replace("status: pending", "status: in-progress"));
    fs.writeFileSync(path.join(repoDir, "code.txt"), "b\n");
    assert.match(run(dir, "--baseline").out, /^OK\nNOTE baseline kept: the plan has started$/);
    commitFiles(repoDir, "code.txt", "README.md");
    const refused = run(dir).out;
    assert.match(refused, /README\.md: modified before the start/);
    assert.doesNotMatch(refused, /code\.txt/);
  });

  it("asks nothing when no baseline was recorded", () => {
    const { repoDir, dir } = startedRepo();
    commitFiles(repoDir, "README.md");
    assert.match(run(dir).out, /^OK(\n|$)/);
  });

  it("leaves the plan folder out of the baseline, however dirty it was", () => {
    const { repoDir, dir } = startedRepo({ planFolderDirty: true });
    const r = run(dir, "--baseline");
    assert.match(r.out, /^OK\nNOTE already modified \(1\): README\.md$/);
    git(repoDir, "add", path.relative(repoDir, dir));
    git(repoDir, "commit", "-q", "-m", "plan files");
    assert.match(run(dir).out, /^OK(\n|$)/);
  });

  it("holds a baseline to its own plan folder", () => {
    const { repoDir, dir } = startedRepo();
    run(dir, "--baseline");
    const other = folder("in-progress", [{ status: "in-progress" }], { into: repoDir });
    commitFiles(repoDir, "README.md");
    assert.match(run(other).out, /^OK(\n|$)/);
  });

  it("names a file whose name holds spaces", () => {
    const { repoDir, dir } = startedRepo();
    fs.writeFileSync(path.join(repoDir, "my notes.txt"), "x");
    run(dir, "--baseline");
    commitFiles(repoDir, "my notes.txt");
    assert.match(run(dir).out, /my notes\.txt: modified before the start/);
  });

  it("skips the check when the recorded commit is no longer in the history", () => {
    const { repoDir, dir } = startedRepo();
    run(dir, "--baseline");
    git(repoDir, "checkout", "-q", "--orphan", "other");
    git(repoDir, "rm", "-rf", "--cached", "-q", ".");
    git(repoDir, "commit", "-q", "-m", "unrelated", "--allow-empty");
    assert.match(run(dir).out, /^OK(\n|$)/);
  });
});
