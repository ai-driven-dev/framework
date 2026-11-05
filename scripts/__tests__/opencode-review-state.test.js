const test = require('node:test');
const assert = require('node:assert/strict');
const { encodeReviewState, latestReviewState, planReview } = require('../opencode-review-state.mjs');

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

test('fails closed on truncated or absent patches, metadata and API totals', () => {
  for (const file of [
    { ...modified(), patch: undefined },
    { ...modified(), patch: '@@ -1 +1 @@\n-old' },
    { ...modified(), patch: '@@ -1,2 +1,2 @@\n-old\n+new' },
    { ...modified(), additions: 2 },
    { ...modified(), patch: '@@ -1 +1 @@\n-old\n+new\n+extra' },
    { ...modified(), patch: '@@ -1 +1 @@\n-old\n+new\n...' },
    { ...modified(), patch: '@@ -1 +1 @@\n-old\n+new\n@@ -3 +3 @@\n-old' },
    { ...modified(), sha: 'bad' },
    { ...modified(), status: 'renamed' },
  ]) assert.throws(() => planReview([file]), /Invalid review state/);
  assert.throws(() => planReview([modified(), modified()]), /duplicate filename/);
  assert.throws(() => planReview([modified()], { x: 'invalid hash' }), /invalid file fingerprint/);
});

test('round trips marker and uses only the latest trusted bot comment', () => {
  const first = planReview([modified()]).current;
  const second = planReview([modified('src/b.js')]).current;
  const older = encodeReviewState({ files: first, head, reviewId: 101 });
  const newer = encodeReviewState({ files: second, head, reviewId: '102' });
  assert.deepEqual(latestReviewState([comment(2, `report\n${newer}`), comment(1, older), comment(3, older, 12345)]), { version: 1, files: second, head, reviewId: '102' });
  assert.equal(latestReviewState([comment(1, 'regular comment'), comment(2, older, 12345)]), null);
});

test('latest malformed or duplicated bot marker fails closed', () => {
  const state = encodeReviewState({ files: {}, head, reviewId: '1' });
  for (const bad of [
    '<!-- aidd-opencode-review-state:v1 invalid -->',
    '<!-- aidd-opencode-review-state:v2 eyJ2ZXJzaW9uIjoyfQ -->',
    '<!-- aidd-opencode-review-state:v1 not-base64-json -->',
  ]) assert.throws(() => latestReviewState([comment(1, state), comment(2, bad)]), /Invalid review state/);
  assert.throws(() => encodeReviewState({ files: {}, head: 'bad', reviewId: '1' }), /invalid head/);
  assert.throws(() => encodeReviewState({ files: {}, head, reviewId: '0' }), /invalid review ID/);
});


test('accepts a report quoting an older marker before the final state', () => {
  const first = encodeReviewState({ files: {}, head, reviewId: '1' });
  const second = encodeReviewState({ files: {}, head, reviewId: '2' });
  assert.equal(latestReviewState([comment(1, `Example: ${first}\n\n${second}`)]).reviewId, '2');
});
