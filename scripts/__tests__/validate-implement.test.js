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

const FINDING = / IMPLEMENT-\d+ /;

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
  `## Run ${number}\n\n- Head: \`${head}\`\n- Left: none\n\n| Task | Validation | Result |\n| ---- | ---------- | ------ |\n${rows.join("\n")}\n`;
const RUN_MD = `# Run: A plan\n\n${runMd()}`;

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
  return { out: r.stdout.trim(), err: r.stderr.trim(), code: r.status };
}

before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "validate-implement-"));
});
after(() => fs.rmSync(root, { recursive: true, force: true }));

describe("validate-implement", () => {
  it("accepts a plan midway: done, then in progress on what it needed", () => {
    const r = run(folder("in-progress", [{ status: "done" }, { status: "in-progress", deps: "1" }]));
    assert.doesNotMatch(r.out, FINDING);
  });

  it("accepts an implemented plan with every phase done", () => {
    assert.equal(run(folder("implemented", [{ status: "done" }, { status: "done", deps: "1" }])).out, "");
  });

  it("accepts a blocked plan whatever its phases hold", () => {
    assert.equal(run(folder("blocked", [{ status: "done" }, { status: "in-progress", deps: "1" }])).out, "");
  });

  it("accepts the same plan saved with Windows line endings", () => {
    const r = run(folder("in-progress", [{ status: "done" }, { status: "in-progress", deps: "1" }], { crlf: true }));
    assert.doesNotMatch(r.out, FINDING);
  });

  it("refuses a plan status outside the lifecycle", () => {
    const r = run(folder("done", [{ status: "pending" }]));
    assert.equal(r.code, 1);
    assert.match(r.out, /plan\.md:\d+ IMPLEMENT-01 .*"done"/);
  });

  it("refuses a phase status outside the lifecycle", () => {
    const r = run(folder("in-progress", [{ status: "implemented" }]));
    assert.match(r.out, /phase-1\.md:\d+ IMPLEMENT-02 .*"implemented"/);
  });

  it("refuses a pending plan whose phase has moved", () => {
    const r = run(folder("pending", [{ status: "in-progress" }]));
    assert.match(r.out, /plan\.md:1 IMPLEMENT-03 status pending but phase 1 is in-progress/);
  });

  it("refuses an implemented plan with a phase not done", () => {
    const r = run(folder("implemented", [{ status: "done" }, { status: "in-progress", deps: "1" }]));
    assert.match(r.out, /plan\.md:1 IMPLEMENT-03 status implemented but phase 2 is in-progress/);
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
    assert.match(r.out, /run\.md:1 IMPLEMENT-05 no "## Run" recorded, append one/);
  });

  it("refuses an implemented plan whose run file holds no run", () => {
    const r = run(folder("implemented", [{ status: "done" }], { runs: "# Run\n" }));
    assert.match(r.out, /run\.md:1 IMPLEMENT-05 no "## Run" recorded/);
  });

  it("asks for no run before the plan is implemented", () => {
    assert.doesNotMatch(run(folder("in-progress", [{ status: "in-progress" }])).out, FINDING);
  });

  it("refuses a phase started before what it depends on is done", () => {
    const r = run(folder("in-progress", [{ status: "in-progress" }, { status: "pending", deps: "1" }, { status: "done", deps: "1, 2" }]));
    assert.match(r.out, /phase 3 is done but depends on phase 2 \(pending\)/);
  });

  it("lets a blocked plan stop with phases half done, in progress together", () => {
    const r = run(folder("blocked", [{ status: "in-progress" }, { status: "in-progress" }]));
    assert.doesNotMatch(r.out, FINDING);
  });

  it("lets a blocked plan stop in a phase whose dependency is not done", () => {
    const r = run(folder("blocked", [{ status: "pending" }, { status: "in-progress", deps: "1" }]));
    assert.doesNotMatch(r.out, FINDING);
  });

  it("reads the front matter of a phase with no status as pending", () => {
    const dir = folder("pending", [{ status: "pending" }]);
    fs.writeFileSync(path.join(dir, "phase-1.md"), "# Instruction: x\n");
    assert.match(run(dir).out, /phase-1\.md:\d+ IMPLEMENT-02 /);
  });
});

const git = (dir, ...args) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "core.hooksPath=/dev/null", "-C", dir, ...args], { encoding: "utf8", env: cleanEnv() });

/** The plan commit first, then the run that names it as its head, as a real pass records it. */
function commitWithRun(dir) {
  git(dir, "init", "-q");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "plan");
  const head = git(dir, "rev-parse", "HEAD").stdout.trim();
  fs.writeFileSync(path.join(dir, "run.md"), `# Run: A plan\n\n${runMd(1, head)}`);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "run");
  return dir;
}

describe("validate-implement: files and folders as real machines write them", () => {
  it("works on a folder whose path holds spaces and is given with a trailing separator", () => {
    const parent = fs.mkdtempSync(path.join(root, "with space-"));
    const dir = path.join(parent, "my feature");
    fs.mkdirSync(dir);
    const src = folder("in-progress", [{ status: "in-progress" }]);
    for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dir, f));
    assert.doesNotMatch(run(dir + path.sep).out, FINDING);
  });

  it("says what to pass when no folder is given", () => {
    const r = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8", env: cleanEnv() });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /^usage: /);
  });

  it("says the plan is missing when the folder does not exist", () => {
    const r = run(path.join(root, "no-such-folder"));
    assert.equal(r.code, 2);
    assert.match(r.err, /plan\.md: missing/);
  });

  it("reports a listed phase whose file is absent as nothing to check, validate-plan owns that", () => {
    const dir = folder("in-progress", [{ status: "in-progress" }, { status: "pending", deps: "1" }]);
    fs.rmSync(path.join(dir, "phase-2.md"));
    assert.doesNotMatch(run(dir).out, FINDING);
  });
});

describe("validate-implement: what a run records", () => {
  const closedWith = (text) => run(folder("implemented", [{ status: "done" }], { runs: text }));
  const filledTemplate = () =>
    withoutComments(fs.readFileSync(RUN_TEMPLATE, "utf8"))
      .replace("{{the plan's title}}", "A plan")
      .replace("{{number}}", "1")
      .replace("{{sha of HEAD when the validations ran}}", "abc1234")
      .replace("{{phase.task, such as 1.2}}", "1.1").replace("{{scenario of that task's criterion, and the command that ran it}}", "pnpm test")
      .replace("{{observable outcome}}", "80 passed")
      .replace(/\{\{undone[^}]*\}\}/, "none");

  it("accepts a run filled from the template", () => {
    assert.doesNotMatch(closedWith(filledTemplate()).out, FINDING);
  });

  it("refuses the template as it stands", () => {
    assert.match(closedWith(fs.readFileSync(RUN_TEMPLATE, "utf8")).out, /run\.md:\d+ IMPLEMENT-04 (placeholder|comment) left/);
  });

  it("accepts several runs numbered in order", () => {
    assert.doesNotMatch(closedWith(`# Run: A plan\n\n${runMd(1)}\n${runMd(2)}`).out, FINDING);
  });

  it("refuses a run that names no head", () => {
    assert.match(closedWith(`# Run: A plan\n\n${runMd(1).replace("- Head: `abc1234`\n", "")}`).out, /run 1: "Head:" needs a commit sha/);
  });

  it("refuses a head that is not a sha", () => {
    assert.match(closedWith(`# Run: A plan\n\n${runMd(1, "latest")}`).out, /run 1: "Head:" needs a commit sha/);
  });

  it("refuses a head that is no commit of the repository", () => {
    const dir = commitWithRun(folder("implemented", [{ status: "done" }], { runs: null }));
    fs.writeFileSync(path.join(dir, "run.md"), `# Run: A plan\n\n${runMd(1, "deadbeef")}`);
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "wrong head");
    assert.match(run(dir).out, /run 1: head deadbeef is not a commit/);
  });

  it("refuses a run with no validation row", () => {
    const empty = runMd(1, "abc1234", []);
    assert.match(closedWith(`# Run: A plan\n\n${empty}`).out, /run 1: needs a "Task \| Validation \| Result" table with a row/);
  });

  it("refuses a validation row left empty", () => {
    const empty = runMd(1, "abc1234", ["| 1.1 | pnpm test |  |"]);
    assert.match(closedWith(`# Run: A plan\n\n${empty}`).out, /run 1: needs a "Task \| Validation \| Result" table with a row/);
  });

  it("refuses a run that does not say what is left", () => {
    assert.match(closedWith(`# Run: A plan\n\n${runMd(1).replace("- Left: none\n", "")}`).out, /run 1: "Left:" missing/);
  });

  it("refuses a comment left in the run file", () => {
    assert.match(closedWith(`# Run: A plan\n\n<!-- note -->\n${runMd(1)}`).out, /run\.md:\d+ IMPLEMENT-04 (placeholder|comment) left/);
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
    const dir = folder("implemented", tasks.map(() => ({ status: "done" })), { runs: `# Run: A plan\n\n${runMd(1, "abc1234", rows)}` });
    tasks.forEach((count, i) => fs.writeFileSync(path.join(dir, `phase-${i + 1}.md`), phaseMd("done", count)));
    return run(dir);
  };
  const row = (task) => `| ${task} | pnpm test | passed |`;

  it("names a task the run has no row for", () => {
    assert.match(withTasks([row("1.1"), row("2.1")]).out, /run\.md:\d+ IMPLEMENT-05 run 1 has no row for task 1\.2/);
  });

  it("names every missing task", () => {
    assert.match(withTasks([row("1.1")]).out, /task 1\.2[\s\S]*task 2\.1/);
  });

  it("asks nothing of a phase that lists no task", () => {
    assert.doesNotMatch(withTasks([row("1.1")], [1, 0]).out, FINDING);
  });

  it("reads the last run alone: an earlier one may cover less", () => {
    const dir = folder("implemented", [{ status: "done" }], { runs: `# Run: A plan\n\n${runMd(1, "abc1234", [row("1.1")])}\n${runMd(2, "abc1234", [row("1.1"), row("1.2")])}` });
    fs.writeFileSync(path.join(dir, "phase-1.md"), phaseMd("done", 2));
    assert.doesNotMatch(run(dir).out, FINDING);
  });

  it("refuses a last run that covers less than the plan", () => {
    const dir = folder("implemented", [{ status: "done" }], { runs: `# Run: A plan\n\n${runMd(1, "abc1234", [row("1.1"), row("1.2")])}\n${runMd(2, "abc1234", [row("1.1")])}` });
    fs.writeFileSync(path.join(dir, "phase-1.md"), phaseMd("done", 2));
    assert.match(run(dir).out, /run 2 has no row for task 1\.2/);
  });
});

