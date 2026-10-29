const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, 'fixtures/context-generation');
const manifest = JSON.parse(readFileSync(path.join(root, 'artifact-manifest.json'), 'utf8'));
const read = (relative) => readFileSync(path.join(root, relative));

test('local Kilo generation fixtures match their checked-in artifact manifest', () => {
  assert.ok(Object.keys(manifest).length > 0);
  for (const [relative, expected] of Object.entries(manifest)) {
    assert.equal(createHash('sha256').update(read(relative)).digest('hex'), expected, relative);
  }
});

test('local Kilo skill fixture contains one native tree and preserves its user resource', () => {
  const skill = read('skills/native/.kilo/skills/verify-payload/SKILL.md').toString('utf8');
  assert.match(skill, /^name: verify-payload$/mu);
  assert.match(skill, /description:/u);
  assert.doesNotMatch(skill, /argument-hint:|allowed-tools:/u);
  assert.equal(existsSync(path.join(root, 'skills/native/.agents/skills/verify-payload/SKILL.md')), false);
  assert.equal(
    read('skills/native/.kilo/skills/verify-payload/assets/user.txt').toString('utf8'),
    'USER_RESOURCE_DO_NOT_REPLACE\n',
  );
  assert.match(
    read('skills/native/.kilo/skills/verify-payload/actions/01-verify.md').toString('utf8'),
    /assets\/payload\.txt/u,
  );
});

test('local Kilo rule fixtures distinguish linked and unlinked configurations', () => {
  const rule = read('kilo-rule/rule.md').toString('utf8');
  const positive = read('kilo-rule/positive-config.jsonc').toString('utf8');
  const negative = read('kilo-rule/negative-config.jsonc').toString('utf8');
  const exactPath = '.kilo/rules/01-standards/1-naming.md';
  assert.match(rule, /KILO_RULE_FIXTURE_MARKER/u);
  assert.ok(positive.includes(exactPath));
  assert.ok(!negative.includes(exactPath));
});

test('local agent and workflow fixtures retain Kilo frontmatter and payload paths', () => {
  const agent = read('agents-commands/native/.kilo/agents/verify-agent.md').toString('utf8');
  const workflow = read('agents-commands/native/.kilo/commands/verify-workflow.md').toString('utf8');
  assert.match(agent, /mode: subagent/u);
  assert.match(agent, /\.kilo\/agents\/assets\/agent-payload\.txt/u);
  assert.match(workflow, /agent: verify-agent/u);
  assert.match(workflow, /\.kilo\/commands\/assets\/workflow-payload\.txt/u);
});
