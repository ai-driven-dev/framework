const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { describe, it, beforeEach, afterEach } = require("node:test");

const SKILL = path.resolve(__dirname, "../../plugins/aidd-context/skills/04-skill-generate");
const ENGINE = path.join(SKILL, "scripts/scaffold-skill.cjs");
const CHECK = path.join(SKILL, "scripts/validate-skill.cjs");

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
    fs.writeFileSync(full, text.replace(/^> Fill every.*\n/mu, "").replace(/\{\{[^}\n]+\}\}/gu, "Filled."));
  }
}

function withPlan(change) {
  const plan = structuredClone(PLAN);
  change(plan);
  return plan;
}

function native(root, payload, ...options) {
  const result = spawnSync(process.execPath, [ENGINE, "--native", "-", root, ...options], {
    input: JSON.stringify({ name: PLAN.name, ...payload }),
    encoding: "utf8",
  });
  return { status: result.status, output: result.stdout, error: result.stderr };
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

  it("previews distinct host metadata, then edits only the approved frontmatter", () => {
    const claude = path.join(root, ".claude/skills/brainstorm");
    const kilo = path.join(root, ".kilo/skills/brainstorm");
    for (const folder of [claude, kilo]) {
      assert.equal(run(PLAN, folder).code, 0);
      fillContent(folder);
    }
    const claudeFile = path.join(claude, "SKILL.md");
    const kiloFile = path.join(kilo, "SKILL.md");
    const current = fs.readFileSync(claudeFile, "utf8").replace("\n---", '\nmetadata:\n  author: "AIDD"\n---');
    fs.writeFileSync(claudeFile, current);
    const kiloBefore = fs.readFileSync(kiloFile, "utf8");
    const action = path.join(claude, "actions/01-capture.md");
    const actionBefore = fs.readFileSync(action, "utf8");
    const payload = {
      targets: ["claude", "kilo"],
      nativeOptions: { claude: { "disable-model-invocation": true }, kilo: { metadata: { category: "planning" } } },
    };
    const preview = native(root, payload, "--plan");
    assert.equal(preview.status, 0, preview.error);
    assert.deepEqual(JSON.parse(preview.output).changes.map(({ hosts, operation, options }) => [hosts, operation, options]), [
      [["claude"], "update", payload.nativeOptions.claude],
      [["kilo"], "update", payload.nativeOptions.kilo],
    ]);
    assert.equal(fs.readFileSync(claudeFile, "utf8"), current);
    assert.equal(fs.readFileSync(kiloFile, "utf8"), kiloBefore);
    const result = native(root, payload);
    assert.equal(result.status, 0, result.error);
    assert.equal(fs.readFileSync(claudeFile, "utf8"), current.replace("\n---", "\ndisable-model-invocation: true\n---"));
    assert.equal(fs.readFileSync(kiloFile, "utf8"), kiloBefore.replace("\n---", '\nmetadata: {"category":"planning"}\n---'));
    assert.equal(fs.readFileSync(action, "utf8"), actionBefore);
    assert.deepEqual(JSON.parse(native(root, payload, "--plan").output).changes.map(({ operation }) => operation), ["unchanged", "unchanged"]);
    assert.equal(spawnSync(process.execPath, [CHECK, claude], { encoding: "utf8" }).status, 0);
  });

  it("plans one write per shared target only for structurally equal options", () => {
    const first = { metadata: { category: "planning", maintainer: "AIDD" } };
    const second = { metadata: { maintainer: "AIDD", category: "planning" } };
    const targets = ["codex", "antigravity", "kimi"];
    const preview = native(root, { targets, nativeOptions: { codex: first, antigravity: second, kimi: second } }, "--plan");
    assert.equal(preview.status, 0, preview.error);
    const { changes } = JSON.parse(preview.output);
    assert.equal(changes.length, 1);
    assert.equal(changes[0].path, ".agents/skills/brainstorm/SKILL.md");
    const conflict = native(root, {
      targets: ["claude", ...targets],
      nativeOptions: { claude: { "disable-model-invocation": true }, codex: first, kimi: second },
    });
    assert.equal(conflict.status, 1);
    assert.match(conflict.error, /\.agents\/skills\/brainstorm\/SKILL\.md.*codex.*antigravity/u);
    assert.deepEqual(fs.readdirSync(root), []);
  });

  it("writes every supported project target through the installed skill", (t) => {
    const installed = fs.mkdtempSync(path.join(os.tmpdir(), "skill-installed-"));
    t.after(() => fs.rmSync(installed, { recursive: true, force: true }));
    fs.cpSync(SKILL, installed, { recursive: true });
    const engine = path.join(installed, "scripts/scaffold-skill.cjs");
    const targets = ["claude", "cursor", "opencode", "copilot", "codex", "kilo", "antigravity", "kiro", "kimi"];
    const payload = { name: PLAN.name, targets, nativeOptions: Object.fromEntries(targets.map((host) => [host, { license: "MIT" }])) };
    const invoke = (...flags) => spawnSync(process.execPath, [engine, "--native", "-", root, ...flags], {
      input: JSON.stringify(payload), encoding: "utf8", cwd: installed, env: { PATH: "" },
    });
    const preview = invoke("--plan");
    assert.equal(preview.status, 0, preview.stderr);
    const { changes } = JSON.parse(preview.stdout);
    assert.deepEqual(changes.flatMap(({ hosts }) => hosts).sort(), [...targets].sort());
    assert.deepEqual(changes.map((change) => change.path.split("/")[0]), [".claude", ".cursor", ".opencode", ".github", ".agents", ".kilo", ".kiro"]);
    assert.deepEqual(fs.readdirSync(root), []);
    for (const change of changes) assert.equal(run(PLAN, path.dirname(path.join(root, change.path))).code, 0);
    const apply = invoke();
    assert.equal(apply.status, 0, apply.stderr);
    for (const change of changes) assert.match(fs.readFileSync(path.join(root, change.path), "utf8"), /\nlicense: "MIT"\n---\n/u);
  });

  it("refuses native edits to scaffold fields before any target changes", () => {
    const result = native(root, { targets: ["claude"], nativeOptions: { claude: { name: "other" } } }, "--plan");
    assert.equal(result.status, 1);
    assert.match(result.error, /claude.*name.*managed/u);
    assert.deepEqual(fs.readdirSync(root), []);
  });

  it("refuses a read-only native target before changing any selected skill", { skip: process.platform === "win32" || process.geteuid?.() === 0 }, () => {
    const claude = path.join(root, ".claude/skills/brainstorm");
    const kilo = path.join(root, ".kilo/skills/brainstorm");
    for (const folder of [claude, kilo]) assert.equal(run(PLAN, folder).code, 0);
    const claudeFile = path.join(claude, "SKILL.md");
    const kiloFile = path.join(kilo, "SKILL.md");
    const before = fs.readFileSync(claudeFile, "utf8");
    fs.chmodSync(kiloFile, 0o444);
    const payload = {
      targets: ["claude", "kilo"],
      nativeOptions: { claude: { "disable-model-invocation": true }, kilo: { license: "MIT" } },
    };
    try {
      for (const flags of [["--plan"], []]) {
        const result = native(root, payload, ...flags);
        assert.equal(result.status, 1);
        assert.match(result.error, /\.kilo\/skills\/brainstorm\/SKILL\.md/u);
        assert.equal(fs.readFileSync(claudeFile, "utf8"), before);
        assert.equal(fs.readFileSync(kiloFile, "utf8"), before);
      }
    } finally {
      fs.chmodSync(kiloFile, 0o644);
    }
  });

  it("refuses preview when a missing skill must be created under a read-only directory", { skip: process.platform === "win32" || process.geteuid?.() === 0 }, () => {
    const kilo = path.join(root, ".kilo");
    fs.mkdirSync(kilo, { mode: 0o555 });
    try {
      const result = native(root, {
        targets: ["claude", "kilo"],
        nativeOptions: { claude: { "disable-model-invocation": true } },
      }, "--plan");
      assert.equal(result.status, 1);
      assert.match(result.error, /\.kilo/u);
      assert.deepEqual(fs.readdirSync(root), [".kilo"]);
      assert.deepEqual(fs.readdirSync(kilo), []);
    } finally {
      fs.chmodSync(kilo, 0o755);
    }
  });

  it("reads a plan from stdin without creating an intermediate plan file", () => {
    const result = spawnSync(process.execPath, [ENGINE, "-", target], { input: JSON.stringify(PLAN), encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(fs.readdirSync(root), ["brainstorm"]);
    assert.deepEqual(fs.readdirSync(path.join(target, "actions")), ["01-capture.md", "02-explore.md", "03-conclude.md"]);
    fillContent(target);
    const check = spawnSync(process.execPath, [CHECK, target], { encoding: "utf8" });
    assert.deepEqual({ code: check.status, out: check.stdout }, { code: 0, out: "" });
  });

  it("rejects malformed JSON from stdin before writing anything", () => {
    const result = spawnSync(process.execPath, [ENGINE, "-", target], { input: "{", encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /scaffold-skill:/u);
    assert.deepEqual(fs.readdirSync(root), []);
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
    assert.match(explore, /\{\{result sentence\}\}/u);
    assert.match(explore, /\{\{step\}\}/u);
    assert.doesNotMatch(explore, /\{\{NN\}\}|\{\{title\}\}|\{\{read-next step\}\}/u);
  });

  it("writes no read-next step in an action that only ends", () => {
    run(withPlan((plan) => (plan.actions[2].next = [{ end: "done" }])));
    assert.doesNotMatch(read("actions/03-conclude.md"), /\]\(\d\d-|\{\{read-next step\}\}/u);
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
    fs.writeFileSync(template, fs.readFileSync(template, "utf8").replace("{{read-next step}}", "{{next}}"));
    const file = path.join(root, "plan.json");
    fs.writeFileSync(file, JSON.stringify(PLAN));
    const result = spawnSync(process.execPath, [path.join(copy, "scripts/scaffold-skill.cjs"), file, target], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\{\{read-next step\}\}/u);
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
    assert.doesNotMatch(explore, /\{\{read-next step\}\}|\r/u);
    assert.match(explore, /\[conclude\]\(03-conclude\.md\)/u);
  });

  it("refuses a call without a plan and a folder with exit 2", () => {
    const result = spawnSync(process.execPath, [ENGINE], { encoding: "utf8" });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /usage: scaffold-skill\.cjs <plan\.json\|-> <skill-folder>/u);
  });
});
