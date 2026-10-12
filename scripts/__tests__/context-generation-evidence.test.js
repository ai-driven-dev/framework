const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const task = path.join(root, 'aidd_docs/tasks/2026_10/2026_10_10_kilo-native-generation-914');
const phase2 = path.join(task, 'evidence/phase-2');
const phase3 = path.join(task, 'evidence/phase-3');
const phase4 = path.join(task, 'evidence/phase-4');
const skillFixtures = path.join(root, 'scripts/__tests__/fixtures/context-generation/skills');

const read = (file) => readFileSync(file, 'utf8');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('saved native skill bytes match the caller rerun receipt', () => {
  const proof = JSON.parse(read(path.join(phase3, 'caller-modify-rerun.json')));
  const files = Object.entries(proof.afterRerun).filter(([name, entry]) =>
    name.startsWith('native/.kilo/skills/verify-payload/') && entry.type === 'file'
  );
  assert.ok(files.length >= 3);
  for (const [relative, recorded] of files) {
    const bytes = readFileSync(path.join(skillFixtures, relative));
    const canonical = Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'));
    assert.equal(hash(canonical), recorded.sha256, relative);
  }
});

test('saved agent and workflow bytes match their caller receipt', () => {
  const receipt = JSON.parse(read(path.join(phase4, 'caller-receipt.json')));
  assert.match(receipt.caller, /Codex/);
  for (const [relative, recorded] of Object.entries(receipt.generated_files)) {
    const bytes = readFileSync(path.join(phase4, 'generated-project', relative));
    assert.equal(bytes.length, recorded.bytes, relative);
    assert.equal(hash(bytes), recorded.sha256, relative);
  }
  assert.deepEqual(Object.keys(receipt.generated_files).sort(), [
    '.kilo/agents/assets/agent-payload.txt',
    '.kilo/agents/verify-agent.md',
    '.kilo/commands/verify-workflow.md',
  ]);
});

test('saved rule configuration links the exact rule; negative removes only the link', () => {
  const rule = read(path.join(phase2, 'runtime-corrections-rule.md'));
  const positive = read(path.join(phase2, 'runtime-corrections-positive-config.jsonc'));
  const negative = read(path.join(phase2, 'runtime-corrections-negative-config.jsonc'));
  const exactPath = '.kilo/rules/01-standards/1-naming.md';
  assert.match(rule, /COBALT_914/);
  assert.match(rule, /aidd_rule_output:path=\.kilo\/rules\/01-standards\/1-naming\.md/);
  assert.ok(positive.includes(exactPath));
  assert.ok(!negative.includes(exactPath));
  assert.match(negative, /\$schema/);
});

test('published runtime excerpts retain positive and negative results without session identifiers', () => {
  const positive = read(path.join(phase2, 'runtime-positive-redacted.jsonl'));
  const negative = read(path.join(phase2, 'runtime-negative-redacted.jsonl'));
  for (const [name, content] of [['positive', positive], ['negative', negative]]) {
    assert.ok(content.trim().length > 0, name);
    for (const line of content.trim().split('\n')) assert.doesNotThrow(() => JSON.parse(line), name);
    assert.doesNotMatch(content, /(?:sessionID|vercelID|request_id|requestId)"\s*:\s*"(?!\[REDACTED\])/i);
  }
  assert.match(positive, /COBALT_914/);
  assert.doesNotMatch(negative, /COBALT_914/);
});
