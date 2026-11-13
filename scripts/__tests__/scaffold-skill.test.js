const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { describe, it, beforeEach, afterEach } = require("node:test");

const SKILL = path.resolve(__dirname, "../../plugins/aidd-context/skills/04-skill-generate");
const ENGINE = path.join(SKILL, "scripts/scaffold-skill.cjs");
const CHECK = path.join(SKILL, "scripts/check-skill.cjs");

/**
 * The generator's scaffold: it fills the structural slots of the skill's own templates from a
 * plan, leaves every content slot to the model, refuses a plan it cannot draw, and never
 * overwrites a file. A scaffold whose content slots are filled passes the skill check.
 */

const PLAN = {
  name: "brainstorm",
  description: "Clarifies a vague intent, when the user wants to brainstorm.",
  actions: [
    { slug: "capture", title: "Capture", next: [{ to: "explore" }] },
    { slug: "explore", title: "Explore", next: [{ to: "explore", label: "ask questions" }, { to: "conclude" }] },
    {
      slug: "conclude",
      title: "Conclude",
      next: [{ to: "explore", label: "explore more" }, { end: "done" }],
    },
  ],
};

let root;
let target;

function run(plan, dir = target, ...extra) {
  const file = path.join(root, "plan.json");
  fs.writeFileSync(file, JSON.stringify(plan));
  const result = spawnSync(process.execPath, [ENGINE, file, dir, ...extra], { encoding: "utf8" });
  return { code: result.status, out: result.stdout, err: result.stderr };
}

function read(file) {
  return fs.readFileSync(path.join(target, file), "utf8");
}

/** What the model does after the scaffold: write each content slot and drop the template notes. */
function fillContent(dir) {
  for (const file of ["SKILL.md", ...fs.readdirSync(path.join(dir, "actions")).map((name) => `actions/${name}`)]) {
    const full = path.join(dir, file);
    const text = fs.readFileSync(full, "utf8");
    fs.writeFileSync(full, text.replace(/^> Fill every.*\n/mu, "").replace(/<[^>\n]+>/gu, "Filled."));
  }
}

function withPlan(change) {
  const plan = structuredClone(PLAN);
  change(plan);
  return plan;
}

describe("skill scaffold", () => {
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-scaffold-"));
    target = path.join(root, "brainstorm");
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("writes a router and one action per plan row, which pass the check once their content is written", () => {
    const { code, err } = run(PLAN);
    assert.equal(code, 0, err);
    assert.deepEqual(fs.readdirSync(path.join(target, "actions")), ["01-capture.md", "02-explore.md", "03-conclude.md"]);
    fillContent(target);
    const check = spawnSync(process.execPath, [CHECK, target], { encoding: "utf8" });
    assert.deepEqual({ code: check.status, out: check.stdout }, { code: 0, out: "" });
  });

  it("fills the frontmatter with name and description only, and the title, from the plan", () => {
    run(PLAN);
    const text = read("SKILL.md");
    assert.match(text, /^---\nname: brainstorm\ndescription: Clarifies a vague intent, when the user wants to brainstorm\.\n---\n\n# Brainstorm\n/u);
  });

  it("draws an entry per case to actions that run on their own, and they pass the check", () => {
    const plan = {
      name: "changelog",
      description: "Writes or shows a changelog, when the user asks for one.",
      entries: [{ to: "write", label: "write it" }, { to: "show", label: "show it" }],
      actions: [
        { slug: "write", title: "Write", next: [{ end: "written" }] },
        { slug: "show", title: "Show", next: [{ end: "shown" }] },
      ],
    };
    const { code, err } = run(plan, path.join(root, "changelog"));
    assert.equal(code, 0, err);
    const text = fs.readFileSync(path.join(root, "changelog/SKILL.md"), "utf8");
    assert.match(text, /entry\(\[request\]\) -->\|"write it"\| write\n/u);
    assert.match(text, /entry -->\|"show it"\| show\n/u);
    fillContent(path.join(root, "changelog"));
    const check = spawnSync(process.execPath, [CHECK, path.join(root, "changelog")], { encoding: "utf8" });
    assert.deepEqual({ code: check.status, out: check.stdout }, { code: 0, out: "" });
  });

  it("refuses an entry to an action the plan does not hold", () => {
    const { code, err } = run(withPlan((plan) => (plan.entries = [{ to: "captur", label: "new" }])));
    assert.equal(code, 1);
    assert.match(err, /entry.*captur/u);
  });

  it("draws every edge, labeled where the plan labels it", () => {
    run(PLAN);
    const text = read("SKILL.md");
    assert.match(text, /flowchart LR/u);
    assert.match(text, /explore -->\|"ask questions"\| explore/u);
    assert.match(text, /conclude --> done\(\(done\)\)/u);
  });

  it("links each next action from the last step, and leaves the content slots to the model", () => {
    run(PLAN);
    const explore = read("actions/02-explore.md");
    assert.match(explore, /^# 02 - Explore\n/u);
    assert.match(explore, /\[conclude\]\(03-conclude\.md\)/u);
    assert.match(explore, /<result sentence>/u);
    assert.match(explore, /<step>/u);
    assert.doesNotMatch(explore, /<NN>|<title>|<read-next step>/u);
  });

  it("writes no read-next step in an action that only ends", () => {
    run(withPlan((plan) => (plan.actions[2].next = [{ end: "done" }])));
    assert.doesNotMatch(read("actions/03-conclude.md"), /\]\(\d\d-|<read-next step>/u);
  });

  it("refuses a next action the plan does not hold", () => {
    const { code, err } = run(withPlan((plan) => (plan.actions[0].next = [{ to: "explor" }])));
    assert.equal(code, 1);
    assert.match(err, /capture.*explor/u);
    assert.equal(fs.existsSync(target), false);
  });

  it("refuses a node that leaves by two unlabeled edges", () => {
    const { code, err } = run(withPlan((plan) => (plan.actions[1].next = [{ to: "capture" }, { to: "conclude" }])));
    assert.equal(code, 1);
    assert.match(err, /explore.*label/u);
  });

  it("refuses an action with no outcome", () => {
    const { code, err } = run(withPlan((plan) => (plan.actions[2].next = [])));
    assert.equal(code, 1);
    assert.match(err, /conclude/u);
  });

  it("never overwrites a file that exists, and says which it kept", () => {
    fs.mkdirSync(path.join(target, "actions"), { recursive: true });
    fs.writeFileSync(path.join(target, "SKILL.md"), "kept\n");
    const { code, out } = run(PLAN);
    assert.equal(code, 0);
    assert.equal(read("SKILL.md"), "kept\n");
    assert.match(out, /kept .*SKILL\.md/u);
    assert.match(out, /created .*01-capture\.md/u);
  });

  it("refuses a template that lost a slot it fills, so no placeholder ships", () => {
    const copy = path.join(root, "copy");
    fs.cpSync(SKILL, copy, { recursive: true });
    const template = path.join(copy, "assets/action-template.md");
    fs.writeFileSync(template, fs.readFileSync(template, "utf8").replace("<read-next step>", "<next>"));
    const file = path.join(root, "plan.json");
    fs.writeFileSync(file, JSON.stringify(PLAN));
    const result = spawnSync(process.execPath, [path.join(copy, "scripts/scaffold-skill.cjs"), file, target], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /<read-next step>/u);
  });

  it("links every next action in one sentence, so an action with several branches passes the check", () => {
    const plan = withPlan((plan) => (plan.actions[2].next = [{ to: "explore", label: "explore more" }, { to: "capture", label: "start over" }, { end: "done" }]));
    const { code, err } = run(plan);
    assert.equal(code, 0, err);
    assert.match(read("actions/03-conclude.md"), /\[explore\]\(02-explore\.md\) when explore more, \[capture\]\(01-capture\.md\) when start over\./u);
    fillContent(target);
    const check = spawnSync(process.execPath, [CHECK, target], { encoding: "utf8" });
    assert.deepEqual({ code: check.status, out: check.stdout }, { code: 0, out: "" });
  });

  it("copies the plan's text as written, dollar patterns included", () => {
    const description = "Costs $' and $& and $1 nothing, when the user asks.";
    run(withPlan((plan) => (plan.description = description)));
    assert.ok(read("SKILL.md").includes(`description: ${description}\n`), read("SKILL.md"));
  });

  for (const [field, change] of [
    ["name", (plan) => (plan.name = "../../escaped")],
    ["slug", (plan) => (plan.actions[0].slug = "../../escaped")],
  ]) {
    it(`refuses a ${field} that is not kebab-case, so nothing is written outside the skill folder`, () => {
      const plan = withPlan(change);
      if (field === "slug") plan.actions[1].next = [{ to: "../../escaped" }];
      const { code, err } = run(plan);
      assert.equal(code, 1);
      assert.match(err, /kebab-case/u);
      assert.equal(fs.existsSync(target), false);
    });
  }

  it("fills templates saved with CRLF line endings, the read-next step included", () => {
    const copy = path.join(root, "copy");
    fs.cpSync(SKILL, copy, { recursive: true });
    for (const name of ["skill-template.md", "action-template.md"]) {
      const template = path.join(copy, "assets", name);
      fs.writeFileSync(template, fs.readFileSync(template, "utf8").replace(/\n/gu, "\r\n"));
    }
    const file = path.join(root, "plan.json");
    fs.writeFileSync(file, JSON.stringify(PLAN));
    const result = spawnSync(process.execPath, [path.join(copy, "scripts/scaffold-skill.cjs"), file, target], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const explore = read("actions/02-explore.md");
    assert.doesNotMatch(explore, /<read-next step>|\r/u);
    assert.match(explore, /\[conclude\]\(03-conclude\.md\)/u);
  });

  it("refuses a call without a plan and a folder with exit 2", () => {
    const result = spawnSync(process.execPath, [ENGINE], { encoding: "utf8" });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /usage: scaffold-skill\.cjs <plan\.json> <skill-folder>/u);
  });
});
