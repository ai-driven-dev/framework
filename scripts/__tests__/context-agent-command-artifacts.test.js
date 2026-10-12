const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const normalizeEol = (text) => text.replace(/\r\n/gu, '\n');
const agent = (file) => read(`plugins/aidd-context/skills/06-agent-generate/${file}`);
const command = (file) => read(`plugins/aidd-context/skills/07-command-generate/${file}`);
const FIXTURES = path.join(__dirname, 'fixtures/context-generation/agents-commands');

test('static contract: Kilo agents use canonical subagent Markdown without Claude name', () => {
  const paths = agent('references/tool-paths.md');
  assert.match(paths, /\| Kilo\s*\| `\.kilo\/agents\/<name>\.md`/u);
  assert.match(paths, /description.*subagent/u);
  assert.match(paths, /`model`, `temperature`, `permission`/u);
  assert.match(paths, /name is the filename/u);
  assert.match(paths, /six Kilo signals/u);
});

test('static contract: Kilo workflows use the canonical command path and supported fields', () => {
  const paths = command('references/tool-paths.md');
  assert.match(paths, /\| Kilo\s*\| `\.kilo\/commands\/<name>\.md`/u);
  assert.match(paths, /`description`, `agent`, `model`, `variant`, `subtask`/u);
  assert.match(paths, /no nested location/u);
  assert.match(paths, /six Kilo signals/u);
});

test('static contract: agent and workflow writers preflight targets and skip unsupported Codex commands', () => {
  for (const [action, paths] of [
    [agent('actions/02-write-agent.md'), agent('references/tool-paths.md')],
    [command('actions/02-write-command.md'), command('references/tool-paths.md')],
  ]) {
    const preflight = action.indexOf('**Preflight.**');
    const publish = action.indexOf('**Publish.**');
    assert.ok(preflight > action.indexOf('**Build.**'));
    assert.ok(publish > preflight);
    assert.match(action.slice(preflight, publish), /every selected target and reference before creating anything/u);
    assert.match(action.slice(preflight, publish), /last target too/u);
    assert.match(action.slice(preflight, publish), /refusal found here leaves all selected targets unchanged/u);
    assert.match(action.slice(publish), /Before each write, compare that target's current state with its preflight state/u);
    assert.match(paths, /existing user (?:agent|workflow).*target-specific requested field unsupported by that tool/u);
    assert.match(paths, /Any refusal known at this gate leaves every selected target unchanged/u);
    assert.match(paths, /Ordinary canonical fields omitted.*still dropped/u);
    assert.match(paths, /compare each target's state with its preflight state immediately before writing it/iu);
    assert.match(paths, /A change after that comparison can still race with the write/u);
    assert.match(paths, /does not provide atomic publication or complete rollback across targets/u);
    assert.match(action, /Skip unchanged bytes; a repeated confirmed request is idempotent and preserves mtime/u);
  }
  assert.match(command('references/tool-paths.md'), /Codex CLI.*Skip/u);
});

test('eval cases cover a last-target refusal for both interpreted generators', () => {
  const cases = JSON.parse(read('scripts/skill-eval/cases.json'));
  for (const [skill, name, absent, preserved] of [
    ['06-agent-generate', 'last Kilo agent collision refuses before Claude write', '.claude/agents/verify-agent.md', '.kilo/agents/verify-agent.md'],
    ['07-command-generate', 'last Kilo workflow collision refuses before Claude write', '.claude/commands/verify-workflow.md', '.kilo/commands/verify-workflow.md'],
  ]) {
    const scenario = cases.find((item) => item.skill === skill && item.name === name);
    assert.ok(scenario, name);
    assert.match(scenario.prompt, /Claude first and Kilo last/u);
    assert.ok(scenario.expect.filesAbsent.includes(absent));
    assert.ok(scenario.expect.filesUnchanged.includes(preserved));
  }
});

test('fixture contract: Kilo agent and workflow have target-specific frontmatter and bodies', () => {
  const agentText = normalizeEol(fs.readFileSync(path.join(FIXTURES, 'native/.kilo/agents/verify-agent.md'), 'utf8'));
  const commandText = normalizeEol(fs.readFileSync(path.join(FIXTURES, 'native/.kilo/commands/verify-workflow.md'), 'utf8'));
  assert.match(agentText, /^---\ndescription: Verify the phase four agent payload\.\nmode: subagent\ntemperature: 0\npermission:\n  read: allow\n---/u);
  assert.doesNotMatch(agentText, /^---[\s\S]*?\nname:/u);
  assert.match(agentText, /\.kilo\/agents\/assets\/agent-payload\.txt/u);
  assert.match(commandText, /^---\ndescription: Verify the phase four workflow payload\.\nagent: verify-agent\nvariant: minimal\nsubtask: true\n---/u);
  assert.doesNotMatch(commandText, /argument-hint|allowed-tools|disable-model-invocation/u);
  assert.match(commandText, /assets\/workflow-payload\.txt/u);
});
