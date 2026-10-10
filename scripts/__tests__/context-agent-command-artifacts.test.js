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

test('Kilo detection and agent contract use canonical subagent Markdown without Claude name', () => {
  const paths = agent('references/tool-paths.md');
  assert.match(paths, /\| Kilo\s*\| `\.kilo\/agents\/<name>\.md`/u);
  assert.match(paths, /description.*subagent/u);
  assert.match(paths, /`model`, `temperature`, `permission`/u);
  assert.match(paths, /name is the filename/u);
  assert.match(paths, /six Kilo signals/u);
});

test('Kilo workflow contract uses the canonical command path and only supported fields', () => {
  const paths = command('references/tool-paths.md');
  assert.match(paths, /\| Kilo\s*\| `\.kilo\/commands\/<name>\.md`/u);
  assert.match(paths, /`description`, `agent`, `model`, `variant`, `subtask`/u);
  assert.match(paths, /no nested location/u);
  assert.match(paths, /six Kilo signals/u);
});

test('agent and workflow writers preflight every target and explicitly skip unsupported Codex commands', () => {
  for (const text of [agent('actions/02-write-agent.md'), command('actions/02-write-command.md')]) {
    assert.ok(text.indexOf('**Preflight.**') >= 0);
    assert.match(text, /collision|symlink|unchanged|idempotent/u);
  }
  assert.match(command('references/tool-paths.md'), /Codex CLI.*Skip/u);
});

test('caller-generated Kilo agent and workflow retain target-specific frontmatter and bodies', () => {
  const agentText = normalizeEol(fs.readFileSync(path.join(FIXTURES, 'native/.kilo/agents/verify-agent.md'), 'utf8'));
  const commandText = normalizeEol(fs.readFileSync(path.join(FIXTURES, 'native/.kilo/commands/verify-workflow.md'), 'utf8'));
  assert.match(agentText, /^---\ndescription: Verify the phase four agent payload\.\nmode: subagent\ntemperature: 0\npermission:\n  read: allow\n---/u);
  assert.doesNotMatch(agentText, /^---[\s\S]*?\nname:/u);
  assert.match(agentText, /\.kilo\/agents\/assets\/agent-payload\.txt/u);
  assert.match(commandText, /^---\ndescription: Verify the phase four workflow payload\.\nagent: verify-agent\nvariant: minimal\nsubtask: true\n---/u);
  assert.doesNotMatch(commandText, /argument-hint|allowed-tools|disable-model-invocation/u);
  assert.match(commandText, /assets\/workflow-payload\.txt/u);
});
