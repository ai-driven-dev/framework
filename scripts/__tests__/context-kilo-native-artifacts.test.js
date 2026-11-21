const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const FIXTURES = path.join(__dirname, "fixtures/context-generation");
const read = (relative) => fs.readFileSync(path.join(FIXTURES, relative), "utf8");

function frontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/u);
  assert.ok(match, "expected YAML frontmatter");
  return { fields: match[1], body: text.slice(match[0].length) };
}

function field(text, name) {
  return text.match(new RegExp(`^${name}: (.+)$`, "mu"))?.[1];
}

test("detection fixtures cover each Kilo signal and reject AGENTS/OpenCode-only projects", () => {
  const scenarios = JSON.parse(read("detection/cases.json"));
  const signals = [".kilo/", "kilo.json", "kilo.jsonc", ".kilo/kilo.json", ".kilo/kilo.jsonc", ".kilocode/"];
  for (const scenario of scenarios) {
    const root = path.join(FIXTURES, "detection", scenario.project);
    const present = signals.some((signal) => {
      const target = path.join(root, signal);
      return fs.existsSync(target) && (signal.endsWith("/") ? fs.statSync(target).isDirectory() : fs.statSync(target).isFile());
    });
    assert.equal(present, scenario.kilo, scenario.name);
    for (const signal of scenario.signals ?? []) assert.ok(fs.existsSync(path.join(root, signal)), `${scenario.name}: ${signal}`);
  }
});

test("native Kilo skill uses parent-name identity and preserves action and user assets", () => {
  const root = "skills/native/.kilo/skills/verify-payload";
  const { fields, body } = frontmatter(read(`${root}/SKILL.md`));
  assert.equal(field(fields, "name"), "verify-payload");
  assert.equal(path.basename(root), field(fields, "name"));
  assert.ok(field(fields, "description"));
  assert.doesNotMatch(fields, /^argument-hint:/mu);
  assert.match(body, /actions\/01-verify\.md/u);
  assert.match(read(`${root}/actions/02-user.md`), /USER_ACTION_KEEP/u);
  assert.equal(read(`${root}/assets/user.txt`), "USER_RESOURCE_DO_NOT_REPLACE\n");
});

test("portable Kilo skill fixture is a single explicitly selected .agents tree", () => {
  const root = "skills/portable/.agents/skills/verify-payload";
  const { fields } = frontmatter(read(`${root}/SKILL.md`));
  assert.equal(field(fields, "name"), "verify-payload");
  assert.equal(path.basename(root), field(fields, "name"));
  assert.equal(fs.existsSync(path.join(FIXTURES, "skills/portable/.kilo/skills/verify-payload")), false);
  assert.equal(read(`${root}/assets/user.txt`), "USER_RESOURCE_DO_NOT_REPLACE\n");
});

test("native Kilo agent and workflow use their documented paths and supported frontmatter", () => {
  const base = "agents-commands/native/.kilo";
  const agent = frontmatter(read(`${base}/agents/verify-agent.md`));
  assert.equal(field(agent.fields, "description"), "Verify the phase four agent payload.");
  assert.equal(field(agent.fields, "mode"), "subagent");
  assert.doesNotMatch(agent.fields, /^name:/mu);
  assert.equal(field(agent.fields, "temperature"), "0");
  assert.match(agent.fields, /^permission:\n  read: allow$/mu);
  const command = frontmatter(read(`${base}/commands/verify-workflow.md`));
  assert.deepEqual([...command.fields.matchAll(/^([a-z]+):/gmu)].map((match) => match[1]).sort(), ["description", "agent", "variant", "subtask"].sort());
  assert.match(command.body, /\.kilo\/commands\/assets\/workflow-payload\.txt/u);
});

test("Kilo rule fixture is unscoped markdown for config-backed publication", () => {
  const rule = read("kilo-rule/rule.md");
  assert.match(rule, /^# Naming fixture\n/u);
  assert.match(rule, /KILO_RULE_FIXTURE_MARKER/u);
  assert.doesNotMatch(rule, /^---\n/mu);
});
