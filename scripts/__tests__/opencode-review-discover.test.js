const { test } = require('node:test');
const assert = require('node:assert/strict');
const { selectReview, discover } = require('../opencode-review/discover.mjs');

const head = 'a'.repeat(40), base = 'b'.repeat(40);
const pr = { number: 2, state: 'open', head: { sha: head, repo: { full_name: 'fork/repo' } }, base: { sha: base } };
const review = { id: 10, state: 'COMMENTED', user: { id: 8973343 }, commit_id: null, submitted_at: '2026-11-05T00:01:00Z' };
const enabledAt = '2026-11-05T00:00:00Z';

test('selects Alex’s submission on the current head, including forks and a changed head', () => {
  const others = [{ ...review, id: 12, user: { id: 1 } }, { ...review, id: 13, state: 'PENDING' }, { ...review, id: 14, submitted_at: null }];
  assert.deepEqual(selectReview(pr, [...others, review], enabledAt), { number: 2, reviewId: 10, head, base });
  assert.equal(selectReview(pr, [review], '2026-11-05T00:02:00Z'), null);
});

test('uses local checkpoints, retries pending drafts, and continues after one PR fails', () => {
  const errors = [];
  const queryPages = (url) => {
    if (url.includes('state=open')) return [{ ...pr, number: 1 }, pr, { ...pr, number: 3 }, { ...pr, number: 4 }];
    if (url.includes('/1/reviews?')) throw new Error('temporary error');
    return [review];
  };
  const store = { load: (number) => number === 2 ? { state: { reviewId: '10' }, draft: null } : number === 3 ? { state: { reviewId: '10', pending: true }, draft: null } : { state: { reviewId: '10' }, draft: { id: 'pending' } } };
  const result = discover({ repository: 'owner/repo', enabledAt, authorId: 8973343, store, queryPages, onError: (e) => errors.push(e) });
  assert.deepEqual(result.map((r) => r.number), [3, 4]);
  assert.match(errors[0], /temporary error/);
});

test('requires a valid activation time, author and persistent store', () => {
  assert.throws(() => discover({ repository: 'owner/repo', enabledAt: '', authorId: 8973343 }), /activation/);
  assert.throws(() => discover({ repository: 'owner/repo', enabledAt, authorId: undefined }), /author/);
  assert.throws(() => discover({ repository: 'owner/repo', enabledAt, authorId: 8973343 }), /state store/);
});
