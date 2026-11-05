const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { createHash } = require('node:crypto');
const { reviewPullRequest, reportFromEvents, retryStore, run, runModel, splitInput } = require('../opencode-review/ci.mjs');

const ALEX = 8973343, head = 'a'.repeat(40), base = 'b'.repeat(40);
const changed = (name, patch = '@@ -1 +1 @@\n-old\n+new') => ({ filename: name, status: 'modified', patch, fingerprint: createHash('sha256').update(name + patch).digest('hex') });
const candidate = { number: 42, reviewId: 10, head, base };

function fixture() {
  const records = new Map();
  const store = { load: (number) => structuredClone(records.get(number) ?? { state: null, draft: null }), save: (number, record) => records.set(number, structuredClone(record)) };
  const server = { pr: { state: 'open', head: { sha: head }, base: { sha: base }, changed_files: 2, title: 'Title', body: 'Context' }, files: [changed('a.js'), changed('b.js')], skipped: [], comments: [] };
  const query = (path, method, body) => {
    if (path.endsWith('/pulls/42')) return server.pr;
    if (path.includes('/reviews/')) {
      const id = Number(path.split('/').at(-1));
      return { id, user: { id: ALEX }, state: server.reviewStates?.[id] ?? server.reviewState ?? 'COMMENTED' };
    }
    if (method === 'POST') {
      server.comments.push({ user: { id: ALEX }, body: body.body });
      if (server.loseResponse) { server.loseResponse = false; throw new Error('response lost'); }
      return {};
    }
    throw new Error(`Unexpected request: ${path}`);
  };
  const queryPages = (path) => path.includes('/comments?') ? server.comments : server.files;
  const calls = [];
  const model = (args) => { calls.push(args); return { report: 'No actionable defect found.', verdict: 'approve', reviewed: args.files }; };
  const fetchObjects = () => ({ mergeBase: base });
  const getDiffs = ({ files }) => ({ files: files.filter((file) => !file.skipped), skipped: server.skipped });
  const options = { repository: 'owner/repo', authorId: ALEX, store, query, queryPages, model, fetchObjects, getDiffs };
  return { server, calls, options, store };
}

test('reviews only changed files and signals omitted files', () => {
  const f = fixture();
  f.server.files.push({ filename: 'image.png', skipped: true }); f.server.pr.changed_files++;
  f.server.skipped.push({ filename: 'image.png', reason: 'binary' });
  assert.equal(reviewPullRequest(candidate, f.options).status, 'published');
  assert.deepEqual(f.calls[0].files, ['a.js', 'b.js']);
  assert.match(f.server.comments[0].body, /image\.png.*binary/);
  assert.equal(reviewPullRequest({ ...candidate, reviewId: 11 }, f.options).status, 'unchanged');
  assert.equal(f.calls.length, 1);
  assert.equal(f.server.comments.length, 1);
  f.server.pr.head.sha = 'f'.repeat(40);
  f.server.files[1] = changed('b.js', '@@ -1 +1 @@\n-old\n+changed');
  assert.equal(reviewPullRequest({ ...candidate, reviewId: 12 }, f.options).status, 'published');
  assert.deepEqual(f.calls[1].files, ['b.js']);
});

test('retries a lost POST response without repeating the model or comment', () => {
  const f = fixture(); f.server.loseResponse = true;
  assert.throws(() => reviewPullRequest(candidate, f.options), /response lost/);
  assert.ok(f.store.load(42).draft);
  assert.equal(reviewPullRequest(candidate, f.options).status, 'published');
  assert.equal(f.calls.length, 1);
  assert.equal(f.server.comments.length, 1);
  assert.equal(f.store.load(42).draft, null);
});

test('discards a draft only after GitHub confirms its review was dismissed', () => {
  const f = fixture(); f.server.loseResponse = true;
  assert.throws(() => reviewPullRequest(candidate, f.options), /response lost/);
  const query = f.options.query;
  f.options.query = (path, ...args) => {
    if (path.endsWith('/reviews/10')) throw new Error('network failure');
    return query(path, ...args);
  };
  assert.throws(() => reviewPullRequest({ ...candidate, reviewId: 11 }, f.options), /network failure/);
  assert.ok(f.store.load(42).draft);
  f.options.query = query;
  f.server.reviewStates = { 10: 'DISMISSED' };
  assert.equal(reviewPullRequest({ ...candidate, reviewId: 11 }, f.options).status, 'published');
  assert.equal(f.store.load(42).draft, null);
  assert.equal(f.store.load(42).state.reviewId, '11');
  assert.equal(f.calls.length, 2);
});

test('preserves old drafts for manual migration and rejects oversized reports without crediting files', () => {
  const f = fixture();
  f.store.save(42, { state: null, draft: { id: 'legacy' } });
  assert.throws(() => reviewPullRequest(candidate, f.options), /draft preserved/);
  assert.ok(f.store.load(42).draft);
  f.store.save(42, { state: null, draft: null });
  f.options.model = (args) => ({ report: 'x'.repeat(61000), verdict: 'approve', reviewed: args.files });
  assert.throws(() => reviewPullRequest(candidate, f.options), /comment limit/);
  assert.equal(f.store.load(42).state, null);
  assert.equal(f.store.load(42).draft, null);
  assert.equal(f.server.comments.length, 0);
});

test('does not finalize an unchanged checkpoint if the PR moves during the check', () => {
  const f = fixture();
  reviewPullRequest(candidate, f.options);
  const query = f.options.query; let reads = 0;
  f.options.query = (path, ...args) => {
    if (path.endsWith('/pulls/42') && ++reads === 2) f.server.pr.head.sha = 'f'.repeat(40);
    return query(path, ...args);
  };
  assert.equal(reviewPullRequest({ ...candidate, reviewId: 11 }, f.options).status, 'partial');
  assert.equal(f.store.load(42).state.pending, true);
  assert.equal(f.calls.length, 1);
});

test('retries only unconfirmed files after partial coverage', () => {
  const f = fixture();
  f.options.model = () => ({ report: 'One file reviewed.', verdict: 'approve', reviewed: ['a.js'] });
  assert.equal(reviewPullRequest(candidate, f.options).status, 'partial');
  assert.deepEqual(Object.keys(f.store.load(42).state.files), ['a.js']);
  f.options.model = (args) => { f.calls.push(args); return { report: 'Done.', verdict: 'approve', reviewed: args.files }; };
  assert.equal(reviewPullRequest(candidate, f.options).status, 'published');
  assert.deepEqual(f.calls[0].files, ['b.js']);
});

test('keeps each file in one session and includes context in the session limit', () => {
  const f = fixture();
  f.server.pr.body = 'context\n'.repeat(2000);
  f.server.files = [changed('a.js', 'a'.repeat(80000)), changed('b.js', 'b'.repeat(80000))];
  assert.equal(reviewPullRequest(candidate, f.options).status, 'partial');
  assert.equal(f.calls.length, 1);
  assert.equal(reviewPullRequest(candidate, f.options).status, 'published');
  assert.equal(f.calls.length, 2);
  assert.ok(f.calls.every((call) => call.inputs.reduce((size, input) => size + Buffer.byteLength(input.text) + Buffer.byteLength(input.begin) + Buffer.byteLength(input.end) + 2, 0) <= 120000));
  assert.deepEqual(f.calls.map((call) => call.files), [['a.js'], ['b.js']]);
  f.server.pr.head.sha = 'f'.repeat(40);
  f.server.files[0] = changed('a.js', 'a'.repeat(115000));
  assert.equal(reviewPullRequest({ ...candidate, reviewId: 11 }, f.options).status, 'published');
  assert.match(f.server.comments.at(-1).body, /a\.js.*volumineux/);
  assert.equal(Object.hasOwn(f.store.load(42).state.files, 'a.js'), false);
  assert.equal(f.calls.length, 2);
});

test('a later model failure preserves completed files and retries only the remaining batch', () => {
  const f = fixture(); let count = 0;
  f.server.files = [changed('a.js', 'a'.repeat(80000)), changed('b.js', 'b'.repeat(80000))];
  f.options.model = (args) => {
    if (++count === 2) throw new Error('temporary failure');
    return { report: 'Done.', verdict: 'approve', reviewed: args.files };
  };
  assert.equal(reviewPullRequest(candidate, f.options).status, 'partial');
  assert.deepEqual(Object.keys(f.store.load(42).state.files), ['a.js']);
  assert.throws(() => reviewPullRequest(candidate, f.options), /temporary failure/);
  assert.deepEqual(Object.keys(f.store.load(42).state.files), ['a.js']);
  f.options.model = (args) => { f.calls.push(args); return { report: 'Done.', verdict: 'approve', reviewed: args.files }; };
  assert.equal(reviewPullRequest(candidate, f.options).status, 'published');
  assert.deepEqual(f.calls[0].files, ['b.js']);
});

test('normal continuation uses the next timer without a failure backoff', () => {
  const f = fixture();
  f.server.pr.number = 42;
  f.server.files = [changed('a.js', 'a'.repeat(80000)), changed('b.js', 'b'.repeat(80000))];
  const query = (path, ...args) => path === 'user' ? { id: ALEX } : f.options.query(path, ...args);
  const queryPages = (path) => path.includes('state=open') ? [f.server.pr] : path.includes('/reviews?') ? [{ id: 10, user: { id: ALEX }, state: 'COMMENTED', submitted_at: '2026-11-05T00:01:00Z' }] : f.options.queryPages(path);
  const retry = { ready: () => true, success: () => { retry.succeeded++; }, failure: () => { retry.failed++; }, succeeded: 0, failed: 0 };
  run({ repository: 'owner/repo', enabledAt: '2026-11-05T00:00:00Z', store: f.store, query, queryPages, model: f.options.model, review: (item, opts) => reviewPullRequest(item, { ...opts, ...f.options }), retry, log: () => {} });
  assert.equal(retry.failed, 0);
  assert.equal(retry.succeeded, 1);
  assert.equal(f.store.load(42).state.pending, true);
});

test('announces unsupported files once across multiple lots', () => {
  const f = fixture();
  f.server.files = [changed('a.js', 'a'.repeat(80000)), changed('b.js', 'b'.repeat(80000)), { filename: 'image.png', skipped: true }];
  f.server.skipped = [{ filename: 'image.png', reason: 'binary' }];
  f.server.pr.changed_files = 3;
  assert.equal(reviewPullRequest(candidate, f.options).status, 'partial');
  assert.match(f.server.comments[0].body, /image\.png.*binary/);
  assert.equal(reviewPullRequest(candidate, f.options).status, 'published');
  assert.doesNotMatch(f.server.comments[1].body, /image\.png/);
});

test('does not publish a dismissed review or an incomplete GitHub file list', () => {
  const f = fixture(); f.server.reviewState = 'DISMISSED';
  assert.throws(() => reviewPullRequest(candidate, f.options), /no longer a submission/);
  f.server.reviewState = 'COMMENTED'; f.server.pr.changed_files = 3;
  assert.throws(() => reviewPullRequest(candidate, f.options), /Incomplete PR file list/);
  assert.equal(f.server.comments.length, 0);
});

test('passes the OpenCode cache path without passing GitHub tokens or unrelated secrets', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'review-env-'));
  t.after(() => process.platform === 'darwin' ? execFileSync('trash', [dir]) : rmSync(dir, { recursive: true, force: true }));
  const executable = join(dir, 'bash');
  writeFileSync(executable, `#!/usr/bin/env node
const fs = require('node:fs'); const path = require('node:path');
if (!process.env.XDG_CACHE_HOME?.endsWith('/cache-sentinel') || process.env.GH_TOKEN || process.env.GITHUB_TOKEN || process.env.UNRELATED_SECRET) process.exit(19);
const dir = process.argv.at(-1), inputs = fs.readdirSync(path.join(dir, '.review-input'));
const use = (tool, input, output = '') => ({ type:'tool_use', part:{ tool, state:{ status:'completed', input, output } } });
const actions = path.join(dir,'.opencode/skills/05-review/actions'); fs.mkdirSync(actions,{recursive:true});
const events = [use('skill', {id:'05-review'}), ...['01-prepare.md','02-review.md','03-conclude.md'].map(name => { fs.writeFileSync(path.join(actions,name),'skill action\\n'); return use('read',{path:'.opencode/skills/05-review/actions/'+name},'skill action'); })];
for (const name of inputs) events.push(use('read',{path:'.review-input/'+name},fs.readFileSync(path.join(dir,'.review-input',name),'utf8')));
events.push({type:'text',part:{text:'OK\\nAIDD_REVIEW_COVERAGE_V1: {"verdict":"approve","reviewed":["a.js"]}'}});
fs.writeFileSync(path.join(dir,'events.jsonl'),events.map(JSON.stringify).join('\\n'));
`);
  chmodSync(executable, 0o755);
  const saved = Object.fromEntries(['PATH', 'XDG_CACHE_HOME', 'GH_TOKEN', 'GITHUB_TOKEN', 'UNRELATED_SECRET'].map((key) => [key, process.env[key]]));
  Object.assign(process.env, { PATH: `${dir}:${saved.PATH}`, XDG_CACHE_HOME: `${dir}/cache-sentinel`, GH_TOKEN: 'test-only', GITHUB_TOKEN: 'test-only', UNRELATED_SECRET: 'test-only' });
  try {
    const inputs = splitInput('patch', 'diff', ['a.js']);
    assert.deepEqual(runModel({ inputs, files: ['a.js'], repository: 'owner/repo', number: 42, head, base, cache: dir }), { report: 'OK', verdict: 'approve', reviewed: ['a.js'] });
  } finally {
    for (const [key, value] of Object.entries(saved)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test('checkpoints an empty selection once and updates it silently for the next submission', () => {
  const f = fixture();
  f.server.files = []; f.server.pr.changed_files = 0;
  assert.equal(reviewPullRequest(candidate, f.options).status, 'published');
  assert.equal(f.calls.length, 0);
  assert.equal(reviewPullRequest({ ...candidate, reviewId: 11 }, f.options).status, 'unchanged');
  assert.equal(f.server.comments.length, 1);
  assert.equal(f.store.load(42).state.reviewId, '11');
});

test('rejects incomplete API lists and identities other than Alex', () => {
  const f = fixture(); f.server.pr.changed_files = 3;
  assert.throws(() => reviewPullRequest(candidate, f.options), /Incomplete PR file list/);
  assert.throws(() => reviewPullRequest(candidate, { ...f.options, authorId: 123 }), /Invalid review parameters/);
});

test('validates that the skill and every input were actually read before trusting coverage', (t) => {
  const workspace = mkdtempSync(join(tmpdir(), 'review-events-')), inputs = [{ file: 'diff-001.md', begin: 'BEGIN', end: 'END' }];
  t.after(() => process.platform === 'darwin' ? execFileSync('trash', [workspace]) : rmSync(workspace, { recursive: true, force: true }));
  const actionsDir = join(workspace, '.opencode/skills/05-review/actions');
  mkdirSync(actionsDir, { recursive: true });
  for (const name of ['01-prepare.md', '02-review.md', '03-conclude.md']) writeFileSync(join(actionsDir, name), 'start action\nend action\n');
  const skill = { type: 'tool_use', part: { tool: 'skill', state: { status: 'completed', input: { id: '05-review' } } } };
  const actions = ['01-prepare.md', '02-review.md', '03-conclude.md'].map((name) => ({ type: 'tool_use', part: { tool: 'read', state: { status: 'completed', input: { path: `.opencode/skills/05-review/actions/${name}` }, output: 'start action\nend action' } } }));
  const read = { type: 'tool_use', part: { tool: 'read', state: { status: 'completed', input: { path: '.review-input/diff-001.md' }, output: 'BEGIN\npatch\nEND' } } };
  const text = { type: 'text', part: { text: 'Review complete.\nAIDD_REVIEW_COVERAGE_V1: {"verdict":"approve","reviewed":["a.js"]}' } };
  assert.deepEqual(reportFromEvents([skill, ...actions, read, text], ['a.js'], inputs, workspace), { report: 'Review complete.', verdict: 'approve', reviewed: ['a.js'] });
  assert.throws(() => reportFromEvents([read, text], ['a.js'], inputs, workspace), /skill was not loaded/);
  assert.throws(() => reportFromEvents([skill, ...actions.slice(0, 2), read, text], ['a.js'], inputs, workspace), /did not read all of skill action 03-conclude/);
  const partial = structuredClone(actions); partial[1].part.state.output = 'start action';
  assert.throws(() => reportFromEvents([skill, ...partial, read, text], ['a.js'], inputs, workspace), /did not read all of skill action 02-review/);
  assert.throws(() => reportFromEvents([skill, ...actions, { ...read, part: { ...read.part, state: { ...read.part.state, output: 'BEGIN only' } } }, text], ['a.js'], inputs, workspace), /did not read all/);
  assert.throws(() => reportFromEvents([skill, ...actions, read, { type: 'error' }, text], ['a.js'], inputs, workspace), /reported an error/);
});

test('splits large inputs and wraps long Unicode lines without dropping characters', () => {
  const source = 'é'.repeat(30000);
  const inputs = splitInput(source, 'diff', ['large']);
  assert.ok(inputs.length > 1);
  assert.ok(inputs.every((input) => Buffer.byteLength(input.text) <= 32000));
  const restored = inputs.map((input) => input.text).join('\n').replace(/ ⤶\n↳ /g, '');
  assert.equal(restored, source);
});

test('retries failures with persisted bounded backoff and resets after success', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'review-backoff-'));
  t.after(() => process.platform === 'darwin' ? execFileSync('trash', [dir]) : rmSync(dir, { recursive: true, force: true }));
  const path = resolve(dir, 'state.json'); let now = 0;
  let retry = retryStore(path, () => now);
  retry.failure('42:10');
  assert.equal(retry.ready('42:10'), false);
  now += 5 * 60_000;
  retry = retryStore(path, () => now);
  assert.equal(retry.ready('42:10'), true);
  retry.failure('42:10');
  now += 9 * 60_000;
  assert.equal(retry.ready('42:10'), false);
  now += 60_000;
  assert.equal(retry.ready('42:10'), true);
  retry.success('42:10');
  assert.equal(retry.ready('42:10'), true);
});
