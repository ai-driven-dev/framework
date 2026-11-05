const test = require('node:test');
const assert = require('node:assert/strict');
const { stateStore, validateState, planReview } = require('../opencode-review/state.mjs');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const sha = 'a'.repeat(40);
const head = 'b'.repeat(40);
const modified = (name = 'src/a.js', patch = '@@ -1 +1 @@\n-old\n+new') => ({ filename: name, status: 'modified', sha, patch, additions: 1, deletions: 1 });
const comment = (id, body, user = 41898282) => ({ id, user: { id: user }, created_at: `2026-11-05T00:00:${String(id).padStart(2, '0')}Z`, body });

test('identifies new and unchanged changes against only the latest successful state', () => {
  const first = planReview([modified(), modified('src/b.js')]);
  assert.equal(first.selected.length, 2);
  const same = planReview([modified(), modified('src/b.js')], first.current);
  assert.equal(same.selected.length, 0);
  const second = planReview([modified('src/a.js', '@@ -1 +1 @@\n-old\n+other')], first.current);
  assert.deepEqual(second.removed, ['src/b.js']);
  assert.equal(second.selected.length, 1);
  const reverted = planReview([modified()], second.current);
  assert.equal(reverted.selected.length, 1, 'return to an older fingerprint is still a change from the latest state');
});

test('distinct paths and metadata never collide, including special object keys', () => {
  const files = [modified('__proto__'), modified('a/b'), modified('a-b')];
  const plan = planReview(files);
  assert.equal(Object.keys(plan.current).length, 3);
  assert.notEqual(plan.current['a/b'], plan.current['a-b']);
  assert.equal(planReview(files, plan.current).selected.length, 0);
  const rename = { ...modified('a/b'), status: 'renamed', previous_filename: 'a-b' };
  assert.equal(planReview([rename], plan.current).selected.length, 1);
});

test('includes the old and new Git mode in the file fingerprint', () => {
  const regular = { ...modified(), oldMode: '100644', newMode: '100644' };
  const executable = { ...regular, newMode: '100755' };
  const previous = planReview([regular]).current;
  assert.equal(planReview([regular], previous).selected.length, 0);
  assert.equal(planReview([executable], previous).selected.length, 1);
  assert.equal(planReview([{ ...regular, newMode: undefined }]).skipped.length, 1);
});

test('handles multi-hunk patches, newline markers, additions, deletions and misleading content', () => {
  const file = { filename: 'file', status: 'modified', sha,
    additions: 3, deletions: 2,
    patch: '@@ -1,3 +1,4 @@ heading\n context\n-@@ fake header\n+@@ fake header\n-++old\n++++new\n+trailing\n\\ No newline at end of file' };
  assert.equal(planReview([file]).selected.length, 1);
  const multi = { filename: 'multiple', status: 'modified', sha, additions: 2, deletions: 2,
    patch: '@@ -1 +1 @@\n-a\n+b\n@@ -5 +5 @@\n-c\n+d' };
  assert.equal(planReview([multi]).selected.length, 1);
  const added = { filename: 'new', status: 'added', sha, additions: 1, deletions: 0, patch: '@@ -0,0 +1 @@\n+new' };
  const removed = { filename: 'deleted', status: 'removed', sha, additions: 0, deletions: 1, patch: '@@ -1 +0,0 @@\n-old' };
  assert.equal(planReview([added, removed]).selected.length, 2);
});

test('skips incomplete files without stopping readable files or recording them as reviewed', () => {
  const unreadable = [
    { ...modified(), patch: undefined },
    { ...modified(), patch: '@@ -1 +1 @@\n-old' },
    { ...modified(), patch: '@@ -1,2 +1,2 @@\n-old\n+new' },
    { ...modified(), additions: 2 },
    { ...modified(), patch: '@@ -1 +1 @@\n-old\n+new\n+extra' },
    { ...modified(), patch: '@@ -1 +1 @@\n-old\n+new\n...' },
    { ...modified(), patch: '@@ -1 +1 @@\n-old\n+new\n@@ -3 +3 @@\n-old' },
    { ...modified(), sha: 'bad' },
    { ...modified(), status: 'renamed' },
  ];
  const previous = planReview([modified()]).current;
  for (const file of unreadable) {
    const plan = planReview([file, modified('valid')], previous);
    assert.deepEqual(plan.selected.map((entry) => entry.filename), ['valid']);
    assert.equal(plan.skipped.length, 1);
    assert.equal(plan.skipped[0].filename, file.filename);
    assert.ok(plan.skipped[0].reason);
    assert.equal(Object.hasOwn(plan.current, file.filename), false);
  }
  const duplicate = planReview([modified(), modified(), modified('valid')]);
  assert.deepEqual(duplicate.selected.map((entry) => entry.filename), ['valid']);
  assert.equal(duplicate.skipped.length, 2);
  assert.equal(Object.hasOwn(duplicate.current, 'src/a.js'), false);
  assert.throws(() => planReview([modified()], { x: 'invalid hash' }), /invalid file fingerprint/);
});

test('retains complete patches with long lines for the caller to segment', () => {
  const text = 'é'.repeat(3000);
  const file = modified('long.txt', `@@ -1 +1 @@\n-old\n+${text}`);
  const plan = planReview([file]);
  assert.deepEqual(plan.selected, [file]);
  assert.deepEqual(plan.skipped, []);
});

test('persists validated state and a pending draft atomically across reloads', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'review-state-'));
  t.after(() => process.platform === 'darwin' ? execFileSync('trash', [dir]) : rmSync(dir, { recursive: true, force: true }));
  const store = stateStore(dir, 'owner/repo');
  assert.deepEqual(store.load(1), { state: null, draft: null });
  const state = validateState({ version: 1, files: {}, head, reviewId: '3', pending: true, atomicFiles: true, verdict: 'changes-requested' });
  store.save(1, { state, draft: { id: 'pending' } });
  assert.deepEqual(stateStore(dir, 'owner/repo').load(1), { state, draft: { id: 'pending' } });
  assert.deepEqual(validateState({ version: 1, files: {}, head, reviewId: '3', unreviewed: [null, '__proto__'] }).unreviewed, [null, '__proto__']);
  assert.deepEqual(validateState({ version: 1, files: { x: 'a'.repeat(64) }, head, reviewId: '3', unreviewed: ['x'] }).unreviewed, ['x']);
  writeFileSync(join(dir, 'owner/repo/1.json'), '{bad');
  assert.throws(() => store.load(1), /JSON/);
});
