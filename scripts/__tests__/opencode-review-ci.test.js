const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { reviewPullRequest, reportFromEvents, retryStore, runModel, splitInput } = require('../opencode-review/ci.mjs');
const { stateStore } = require('../opencode-review/state.mjs');

const ALEX = 8973343, head = 'a'.repeat(40), base = 'b'.repeat(40), sha = 'c'.repeat(40);
const changed = (name) => ({ filename: name, status: 'modified', sha, additions: 1, deletions: 1, patch: '@@ -1 +1 @@\n-old\n+new' });
const candidate = { number: 42, reviewId: 10, head: 'd'.repeat(40), base };

test('runs its entrypoint when installed through a symlink', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'aidd-review-entrypoint-'));
  t.after(() => process.platform === 'darwin' ? execFileSync('trash', [dir]) : rmSync(dir, { recursive: true, force: true }));
  const entry = join(dir, 'ci.mjs');
  symlinkSync(resolve('scripts/opencode-review/ci.mjs'), entry);
  const result = spawnSync(process.execPath, [entry], { encoding: 'utf8', env: { ...process.env, OPENCODE_REVIEW_STATE_DIR: dir, OPENCODE_REVIEW_REPOSITORY: 'invalid', OPENCODE_REVIEW_ENABLED_AT: 'invalid' } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid review state|Invalid repository/);
});

function fixture() {
  const records = new Map();
  const store = { load: (number) => structuredClone(records.get(number) ?? { state: null, draft: null }), save: (number, record) => records.set(number, structuredClone(record)) };
  const server = { pr: { state: 'open', head: { sha: head, repo: { full_name: 'external/fork' } }, base: { sha: base }, changed_files: 2, title: 'Title', body: 'Context' }, files: [changed('a.js'), { ...changed('image.png'), patch: undefined }], comments: [], calls: [] };
  const query = (path, method, body) => {
    server.calls.push({ path, method, body });
    if (path.endsWith('/pulls/42')) return server.pr;
    if (path.includes('/reviews/')) return { id: Number(path.split('/').at(-1)), user: { id: ALEX }, state: server.reviewState ?? 'COMMENTED' };
    if (method === 'POST') {
      server.comments.push({ id: server.comments.length + 1, user: { id: ALEX }, created_at: `2026-11-05T00:00:${String(server.comments.length).padStart(2, '0')}Z`, body: body.body });
      if (server.loseResponse) { server.loseResponse = false; throw new Error('response lost'); }
      return {};
    }
    if (method === 'PATCH') {
      const comment = server.comments.find((item) => path.endsWith(`/${item.id}`));
      comment.body = body.body;
      return {};
    }
    throw new Error(`Unexpected request: ${path}`);
  };
  const queryPages = (path) => path.includes('/comments?') ? server.comments : server.files;
  const calls = [];
  const model = (args) => { calls.push(args); return { report: 'No actionable defect found.', verdict: 'approve', reviewed: args.files }; };
  const recover = ({ files }) => ({ files: [], skipped: files.map((file) => ({ filename: file.filename, reason: 'missing patch' })) });
  const options = { repository: 'owner/repo', authorId: ALEX, store, query, queryPages, model, recover };
  return { server, calls, options, store };
}

test('reviews a fork current head, skips binaries, and does not rerun for unchanged files', () => {
  const f = fixture();
  assert.equal(reviewPullRequest(candidate, f.options).status, 'published');
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0].files, ['a.js']);
  assert.match(f.server.comments[0].body, /image\.png.*missing patch/);
  assert.equal(f.store.load(42).state.head, head);
  assert.deepEqual(Object.keys(f.store.load(42).state.files), ['a.js']);
  assert.equal(reviewPullRequest(candidate, f.options).status, 'already-processed');
  assert.equal(f.calls.length, 1);
  assert.equal(reviewPullRequest({ ...candidate, reviewId: 11 }, f.options).status, 'published');
  assert.equal(f.calls.length, 1, 'unchanged files do not call the model');
  f.server.files[1] = changed('image.png');
  reviewPullRequest({ ...candidate, reviewId: 12 }, f.options);
  assert.equal(f.calls.length, 2);
  assert.deepEqual(f.calls[1].files, ['image.png']);
});

test('only checkpoints confirmed files and retries the remaining files for the same submission', () => {
  const f = fixture();
  f.server.files[1] = changed('b.js');
  f.options.model = () => ({ report: 'One file reviewed.', verdict: 'approve', reviewed: ['a.js'] });
  const first = reviewPullRequest(candidate, f.options);
  assert.equal(first.status, 'partial');
  assert.deepEqual(first.reviewed, ['a.js']);
  assert.match(f.server.comments[0].body, /b\.js.*did not confirm/);
  assert.deepEqual(Object.keys(f.store.load(42).state.files), ['a.js']);
  assert.equal(f.store.load(42).state.pending, true);
  f.options.model = (args) => { f.calls.push(args); return { report: 'Done.', verdict: 'approve', reviewed: args.files }; };
  reviewPullRequest(candidate, f.options);
  assert.deepEqual(f.calls[0].files, ['b.js']);
  assert.equal(f.store.load(42).state.pending, undefined);
  assert.deepEqual(Object.keys(f.store.load(42).state.files).sort(), ['a.js', 'b.js']);
});

test('aggregates the strictest verdict across partial runs on the same commit', () => {
  const f = fixture(); f.server.files[1] = changed('b.js');
  f.options.model = () => ({ report: 'A defect.', verdict: 'changes-requested', reviewed: ['a.js'] });
  assert.equal(reviewPullRequest(candidate, f.options).status, 'partial');
  f.options.model = (args) => ({ report: 'No defect in this segment.', verdict: 'approve', reviewed: args.files });
  assert.equal(reviewPullRequest(candidate, f.options).status, 'published');
  assert.match(f.server.comments.at(-1).body, /Verdict des segments de ce commentaire : approve/);
  assert.match(f.server.comments.at(-1).body, /Verdict cumulé des segments examinés sur ce commit : changes-requested/);
});

test('resumes a long report after a lost POST response without repeating the model or a comment', () => {
  const f = fixture(); let calls = 0;
  f.options.model = (args) => { calls++; return { report: 'é'.repeat(80000), verdict: 'approve', reviewed: args.files }; };
  f.server.loseResponse = true;
  assert.throws(() => reviewPullRequest(candidate, f.options), /response lost/);
  const draft = f.store.load(42).draft;
  assert.ok(draft.chunks.length > 1);
  assert.equal(f.store.load(42).state, null);
  f.server.comments[0].body += '\nEdited by Alex.';
  f.server.comments.push({ id: 999, user: { id: 12345 }, created_at: '2026-11-05T00:00:10Z', body: `<!-- aidd-opencode-review-v2 ${draft.id} 2/${draft.chunks.length} -->` });
  assert.equal(reviewPullRequest(candidate, f.options).status, 'published');
  assert.equal(calls, 1);
  assert.equal(f.server.comments.filter((comment) => comment.user.id === ALEX).length, draft.chunks.length);
  assert.ok(f.server.comments.filter((comment) => comment.user.id === ALEX).every((comment) => Buffer.byteLength(comment.body) < 60000));
  assert.equal(f.store.load(42).state.reviewId, '10');
});

test('reconstructs omitted text patches before deciding which files are reviewable', () => {
  const f = fixture(); let recovered = 0;
  f.options.recover = ({ files }) => { recovered++; return { files: files.map((file) => changed(file.filename)), skipped: [] }; };
  reviewPullRequest(candidate, f.options);
  assert.equal(recovered, 1);
  assert.deepEqual(f.calls[0].files, ['a.js', 'image.png']);
  assert.deepEqual(Object.keys(f.store.load(42).state.files).sort(), ['a.js', 'image.png']);
});

test('publishes readable files when Git recovery fails and retries only the rest', () => {
  const f = fixture();
  f.options.recover = () => { throw new Error('Git temporarily offline'); };
  const first = reviewPullRequest(candidate, f.options);
  assert.equal(first.status, 'partial');
  assert.deepEqual(first.reviewed, ['a.js']);
  assert.match(f.server.comments[0].body, /Git recovery temporarily unavailable/);
  f.options.recover = ({ files }) => ({ files: files.map((file) => changed(file.filename)), skipped: [] });
  assert.equal(reviewPullRequest(candidate, f.options).status, 'published');
  assert.deepEqual(f.calls[1].files, ['image.png']);
});

test('does not checkpoint a transient failure and schedules a new review if the head moves', () => {
  const f = fixture();
  f.options.model = () => { throw new Error('Temporary failure'); };
  assert.throws(() => reviewPullRequest(candidate, f.options), /Temporary failure/);
  assert.equal(f.server.comments.length, 0);
  f.options.model = (args) => { f.server.pr.head.sha = 'f'.repeat(40); return { report: 'Done.', verdict: 'approve', reviewed: args.files }; };
  assert.equal(reviewPullRequest(candidate, f.options).status, 'partial');
  assert.equal(f.server.comments.length, 1);
  assert.match(f.server.comments[0].body, new RegExp(head));
  assert.equal(f.store.load(42).state.pending, true);
});

test('does not publish when Alex dismisses the review while the model runs', () => {
  const f = fixture();
  f.options.model = (args) => { f.server.reviewState = 'DISMISSED'; return { report: 'Done.', verdict: 'approve', reviewed: args.files }; };
  assert.throws(() => reviewPullRequest(candidate, f.options), /no longer a submission by Alex/);
  assert.equal(f.server.comments.length, 0);
});

test('identifies the source file in every batch of a large patch', () => {
  const f = fixture();
  f.server.files = [{ ...changed('large.js'), patch: `@@ -1 +1 @@\n-old\n+${'x'.repeat(180000)}` }];
  f.server.pr.changed_files = 1;
  reviewPullRequest(candidate, f.options);
  assert.ok(f.calls.length > 1);
  for (const call of f.calls) {
    assert.deepEqual(call.files, ['large.js']);
    for (const input of call.inputs.filter((item) => item.file.startsWith('diff-'))) assert.match(input.text, /"large\.js".*part \d+\/\d+/);
  }
});

test('checkpoints completed files when a later batch fails, then retries only unfinished files', () => {
  const f = fixture();
  const large = (name) => ({ ...changed(name), patch: `@@ -1 +1 @@\n-old\n+${'x'.repeat(80000)}` });
  f.server.files = [large('a.js'), large('b.js')];
  let attempt = 0;
  f.options.model = (args) => { attempt++; if (attempt === 2) throw new Error('temporary outage'); return { report: 'Reviewed batch.', verdict: 'approve', reviewed: args.files }; };
  const partial = reviewPullRequest(candidate, f.options);
  assert.equal(partial.status, 'partial');
  assert.deepEqual(partial.reviewed, ['a.js']);
  assert.deepEqual(Object.keys(f.store.load(42).state.files), ['a.js']);
  f.options.model = (args) => { f.calls.push(args); return { report: 'Finished.', verdict: 'approve', reviewed: args.files }; };
  assert.equal(reviewPullRequest(candidate, f.options).status, 'published');
  assert.ok(f.calls.every((call) => call.files.length === 1 && call.files[0] === 'b.js'));
});

test('checkpoints completed batches before the run time budget expires', () => {
  const f = fixture(); let now = 0, calls = 0;
  const large = (name) => ({ ...changed(name), patch: `@@ -1 +1 @@\n-old\n+${'x'.repeat(80000)}` });
  f.server.files = [large('a.js'), large('b.js')];
  f.options.now = () => now;
  f.options.deadline = 1;
  f.options.model = (args) => { calls++; now = 1; return { report: 'Reviewed batch.', verdict: 'approve', reviewed: args.files }; };
  const result = reviewPullRequest(candidate, f.options);
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.reviewed, ['a.js']);
  assert.equal(calls, 1);
  assert.equal(f.store.load(42).state.pending, true);
});

test('resumes a file larger than the time budget without rereading segments', () => {
  const f = fixture();
  f.server.files = [{ ...changed('__proto__'), patch: `@@ -1 +1 @@\n-old\n+${'x'.repeat(600000)}` }];
  f.server.pr.changed_files = 1;
  const seen = new Set(); let clock = 0, total = 0;
  f.options.now = () => clock;
  f.options.deadline = 1;
  f.options.model = (args) => {
    for (const input of args.inputs.filter((item) => item.file.startsWith('diff-'))) {
      const [, number, count] = input.text.match(/part (\d+)\/(\d+)/);
      assert.equal(seen.has(number), false, `segment ${number} was reread`);
      seen.add(number); total = Number(count);
    }
    clock = 1;
    return { report: 'Segment examined.', verdict: 'approve', reviewed: args.files };
  };
  let result;
  for (let attempt = 0; attempt < 20; attempt++) {
    clock = 0;
    result = reviewPullRequest(candidate, f.options);
    const state = f.store.load(42).state;
    if (result.status === 'published') {
      assert.equal(Object.hasOwn(state.files, '__proto__'), true);
      assert.equal(state.parts, undefined);
      break;
    }
    assert.equal(result.status, 'partial');
    assert.equal(Object.hasOwn(state.files, '__proto__'), false);
    assert.equal(Object.hasOwn(state.parts, '__proto__'), true);
  }
  assert.equal(result.status, 'published');
  assert.equal(seen.size, total);
});

test('discards segment progress when the file fingerprint changes', () => {
  const f = fixture();
  const large = (char) => ({ ...changed('large.js'), patch: `@@ -1 +1 @@\n-old\n+${char.repeat(500000)}` });
  f.server.files = [large('x')]; f.server.pr.changed_files = 1;
  let clock = 0;
  f.options.now = () => clock; f.options.deadline = 1;
  f.options.model = (args) => { clock = 1; return { report: 'Segment examined.', verdict: 'approve', reviewed: args.files }; };
  assert.equal(reviewPullRequest(candidate, f.options).status, 'partial');
  const first = f.store.load(42).state.parts['large.js'];
  f.server.files = [large('y')]; clock = 0;
  const names = [];
  f.options.model = (args) => { names.push(...args.inputs.filter((item) => item.file.startsWith('diff-')).map((item) => item.text)); clock = 1; return { report: 'New segment.', verdict: 'approve', reviewed: args.files }; };
  assert.equal(reviewPullRequest(candidate, f.options).status, 'partial');
  const second = f.store.load(42).state.parts['large.js'];
  assert.notEqual(first.fingerprint, second.fingerprint);
  assert.match(names[0], /part 1\//);
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
