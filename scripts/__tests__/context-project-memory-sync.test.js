const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('project-memory sync uses the manual contract without a project-relative hook invocation', () => {
  const sync = read('plugins/aidd-context/skills/02-project-memory/actions/04-sync.md');
  assert.doesNotMatch(sync, /(?:node\s+)?hooks\/update_memory\.js/u);
  assert.match(sync, /deduplicat.*destination/iu);
  assert.match(sync, /README.*before any (?:creation|write|mutation)/iu);
  assert.match(sync, /reinspect|recheck/iu);
  assert.match(sync, /internal\/.*external\//iu);
  assert.match(sync, /README.*`files` block/iu);
  assert.match(sync, /hardlink|multiple hard links/iu);
  assert.match(sync, /AIDD-P11/u);
  assert.match(sync, /Do not stage|Do not add.*Git/iu);
});

test('Kilo README agrees with the supported paths and AIDD output boundary', () => {
  const readme = read('plugins/aidd-context/README.md');
  assert.match(readme, /writes no Kilo plugin or hook/u);
  assert.match(readme, /See \[hook paths\]/u);
  assert.doesNotMatch(readme, /#\d{3,}|2026-09-25|2026-10-10|https:\/\/kilo\.ai/u);
});
