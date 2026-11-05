const test = require('node:test');
const assert = require('node:assert/strict');
const { stateStore } = require('../opencode-review/state.mjs');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

test('persists the checkpoint and pending publication across reloads', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'review-state-'));
  t.after(() => process.platform === 'darwin' ? execFileSync('trash', [dir]) : rmSync(dir, { recursive: true, force: true }));
  const store = stateStore(dir, 'owner/repo');
  assert.deepEqual(store.load(1), { state: null, draft: null });
  const record = { state: { reviewId: '3', files: { x: 'a'.repeat(64) } }, draft: { body: 'review' } };
  store.save(1, record);
  assert.deepEqual(stateStore(dir, 'owner/repo').load(1), record);
  writeFileSync(join(dir, 'owner/repo/1.json'), '{bad');
  assert.throws(() => store.load(1), /JSON/);
});
