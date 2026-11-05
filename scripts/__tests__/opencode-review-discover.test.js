const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { selectReview, discover } = require('../opencode-review-discover.mjs');
const { encodeReviewState } = require('../opencode-review-state.mjs');

const sha = 'a'.repeat(40), base = 'b'.repeat(40), older = 'c'.repeat(40);
const repository = 'owner/repo';
const enabledAt = '2026-11-05T00:00:00Z';
const pr = { number: 2, state: 'open', head: { sha, repo: { full_name: repository } }, base: { sha: base } };
const review = { id: 10, state: 'COMMENTED', user: { id: 8973343 }, commit_id: sha, submitted_at: '2026-11-05T00:01:00Z' };
const options = { repository, enabledAt };

test('selects the latest submitted review by Alex only for the current head', () => {
  const other = { ...review, id: 12, user: { id: 1 }, submitted_at: '2026-11-05T00:03:00Z' };
  const pending = { ...review, id: 13, state: 'PENDING', submitted_at: null };
  assert.deepEqual(selectReview(pr, [other, pending, review], options), { number: 2, reviewId: 10, head: sha, base });
  assert.equal(selectReview(pr, [{ ...review, commit_id: older }], options), null);
  const newerStale = { ...review, id: 11, commit_id: older, submitted_at: '2026-11-05T00:02:00Z' };
  assert.equal(selectReview(pr, [review, newerStale], options), null, 'do not fall back to an earlier matching head');
  const dismissed = { ...review, id: 11, state: 'DISMISSED', submitted_at: '2026-11-05T00:02:00Z' };
  assert.equal(selectReview(pr, [review, dismissed], options), null, 'do not revive an earlier review');
});

test('enforces activation cutoff and excludes forks', () => {
  assert.equal(selectReview(pr, [review], { ...options, enabledAt: '2026-11-05T00:02:00Z' }), null);
  assert.ok(selectReview(pr, [review], { ...options, enabledAt: review.submitted_at }), 'cutoff is inclusive');
  assert.equal(selectReview({ ...pr, head: { ...pr.head, repo: { full_name: 'other/fork' } } }, [review], options), null);
  assert.equal(selectReview({ ...pr, head: { ...pr.head, repo: null } }, [review], options), null);
  for (const enabledAt of [undefined, '', 'tomorrow', '2026-02-30T00:00:00Z', '2026-11-05T00:00:00+00:00']) {
    assert.throws(() => selectReview(pr, [review], { ...options, enabledAt }), /OPENCODE_REVIEW_ENABLED_AT/);
  }
});

test('discovers each same-repository PR using the GitHub review list', () => {
  const calls = [];
  const fork = { ...pr, number: 4, head: { ...pr.head, repo: { full_name: 'other/fork' } } };
  const queryPages = (url) => {
    calls.push(url);
    if (url.includes('state=open')) return [pr, fork];
    if (url.includes('/comments?')) return [];
    return [review];
  };
  assert.deepEqual(discover({ ...options, queryPages }), [{ number: 2, reviewId: 10, head: sha, base }]);
  assert.equal(calls.length, 3);
  assert.ok(calls[0].includes('state=open'));
  assert.ok(calls[1].includes('/2/reviews?'));
  assert.ok(calls[2].includes('/2/comments?'));
});

test('fails closed on incomplete data, duplicates, API errors and oversized matrices', () => {
  assert.throws(() => selectReview(pr, [{ ...review, submitted_at: 'bad' }], options), /submitted_at/);
  assert.throws(() => selectReview({ ...pr, head: { ...pr.head, sha: 'bad' } }, [review], options), /pull request/);
  assert.throws(() => discover({ ...options, queryPages: () => [pr, pr] }), /duplicate pull request/);
  assert.throws(() => discover({ ...options, queryPages: () => { throw new Error('API failure'); } }), /API failure/);
  const prs = Array.from({ length: 257 }, (_, index) => ({ ...pr, number: index + 1 }));
  assert.throws(() => discover({ ...options, queryPages: (url) => url.includes('state=open') ? prs : url.includes('/comments?') ? [] : [review] }), /more than 256/);
});

test('writes an empty Actions matrix when there are no eligible PRs', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'aidd-review-discover-'));
  t.after(() => process.platform === 'darwin' ? execFileSync('trash', [dir]) : rmSync(dir, { recursive: true, force: true }));
  const gh = join(dir, 'gh');
  writeFileSync(gh, '#!/usr/bin/env node\nconsole.log(JSON.stringify({data:{repository:{pullRequests:{pageInfo:{hasNextPage:false,endCursor:null},nodes:[]}}}}))\n');
  chmodSync(gh, 0o755);
  const output = join(dir, 'output'); writeFileSync(output, '');
  const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, GITHUB_REPOSITORY: repository, OPENCODE_REVIEW_ENABLED_AT: enabledAt, GITHUB_OUTPUT: output };
  const result = spawnSync(process.execPath, [resolve('scripts/opencode-review-discover.mjs')], { encoding: 'utf8', env });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(output, 'utf8'), 'matrix={"include":[]}\nhas_candidates=false\n');
});


test('skips a review already processed by the Actions bot, but not a forged comment', () => {
  const marker = encodeReviewState({ files: {}, head: sha, reviewId: review.id });
  const comment = { id: 77, created_at: '2026-11-05T00:04:00Z', body: marker, user: { id: 41898282 } };
  const pages = (comments) => (url) => url.includes('state=open') ? [pr] : url.includes('/comments?') ? comments : [review];
  assert.deepEqual(discover({ ...options, queryPages: pages([comment]) }), []);
  assert.equal(discover({ ...options, queryPages: pages([{ ...comment, user: { id: 1 } }]) }).length, 1);
  assert.throws(() => discover({ ...options, queryPages: pages([{ ...comment, body: '<!-- aidd-opencode-review-state:v2 broken -->' }]) }), /marker/);
});

test('a failure marker stops only the same review and only when posted by the Actions bot', () => {
  const marker = '<!-- aidd-opencode-review-failure:v1 10 -->';
  const comment = { id: 78, created_at: '2026-11-05T00:04:00Z', body: `Review failed.\n\n${marker}`, user: { id: 41898282 } };
  const query = (comments, reviews = [review]) => (url) => url.includes('state=open') ? [pr] : url.includes('/comments?') ? comments : reviews;
  assert.deepEqual(discover({ ...options, queryPages: query([comment]) }), []);
  assert.equal(discover({ ...options, queryPages: query([{ ...comment, user: { id: 123 } }]) }).length, 1);
  assert.equal(discover({ ...options, queryPages: query([{ ...comment, body: `not a marker ${marker}` }]) }).length, 1);
  assert.equal(discover({ ...options, queryPages: query([{ ...comment, body: `Quoted marker:\n${marker}\nnot the trailer` }]) }).length, 1);
  const next = { ...review, id: 11, submitted_at: '2026-11-05T00:05:00Z' };
  assert.equal(discover({ ...options, queryPages: query([comment], [review, next]) })[0].reviewId, 11);
});


function graphPR(number = 2, reviewConnection = null) {
  const r = { databaseId: review.id, state: review.state, submittedAt: review.submitted_at, commit: { oid: review.commit_id }, author: { databaseId: review.user.id } };
  return { number, state: 'OPEN', headRefOid: sha, baseRefOid: base, headRepository: { nameWithOwner: repository }, reviews: reviewConnection ?? { pageInfo: { hasPreviousPage: false }, nodes: [r] } };
}
function graphPage(nodes, hasNextPage = false, endCursor = null) {
  return { pullRequests: { nodes, pageInfo: { hasNextPage, endCursor } } };
}
function graphComments(nodes = [], hasPreviousPage = false) {
  return { number: 2, comments: { nodes, pageInfo: { hasPreviousPage } } };
}

test('groups PRs and candidate comments in two GraphQL requests', () => {
  const calls = [];
  const queryGraph = (query) => {
    calls.push(query);
    if (query.includes('pullRequests(first:100')) return graphPage([graphPR()]);
    return { p0: graphComments() };
  };
  const queryPages = () => { throw new Error('REST fallback not expected'); };
  assert.deepEqual(discover({ ...options, queryGraph, queryPages }), [{ number: 2, reviewId: 10, head: sha, base }]);
  assert.equal(calls.length, 2);
});

test('paginates PRs and falls back to complete REST reviews and comments when truncated', () => {
  const calls = [];
  const graphQueries = [];
  const queryGraph = (query) => {
    graphQueries.push(query);
    if (query.includes('after:null')) return graphPage([], true, 'next-cursor');
    if (query.includes('after:"next-cursor"')) return graphPage([graphPR(2, { pageInfo: { hasPreviousPage: true }, nodes: [] })]);
    return { p0: graphComments([], true) };
  };
  const queryPages = (url) => {
    calls.push(url);
    return url.includes('/reviews?') ? [review] : [];
  };
  assert.equal(discover({ ...options, queryGraph, queryPages })[0].reviewId, 10);
  assert.equal(graphQueries.length, 3);
  assert.equal(calls.length, 2);
  assert.match(calls[0], /reviews/);
  assert.match(calls[1], /comments/);
});

test('uses complete REST comments when the GraphQL comment window is truncated', () => {
  const failure = { databaseId: 44, body: '<!-- aidd-opencode-review-failure:v1 10 -->', createdAt: '2026-11-05T00:03:00Z', author: { databaseId: 41898282 } };
  const queryGraph = (query) => query.includes('pullRequests(first:100') ? graphPage([graphPR()]) : { p0: graphComments([failure], true) };
  let calls = 0;
  const queryPages = () => { calls++; return [{ id: 44, body: failure.body, created_at: failure.createdAt, user: { id: 41898282 } }]; };
  assert.deepEqual(discover({ ...options, queryGraph, queryPages }), []);
  assert.equal(calls, 1);
});

test('fails on malformed GraphQL data or repeated pagination cursors', () => {
  assert.throws(() => discover({ ...options, queryGraph: () => ({}), queryPages: () => [] }), /GraphQL pull request connection/);
  assert.throws(() => discover({ ...options, queryGraph: () => graphPage([], true, 'same'), queryPages: () => [] }), /cursor/);
});
