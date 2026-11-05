const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const script = resolve('scripts/opencode-review-ci.mjs');
const head = 'a'.repeat(40), base = 'b'.repeat(40), sha = 'c'.repeat(40);
const file = { filename: 'app.js', status: 'modified', sha, additions: 1, deletions: 1, patch: '@@ -1 +1 @@\n-old\n+new' };
const pr = { state: 'open', head: { sha: head, repo: { full_name: 'owner/repo' } }, base: { sha: base }, number: 2, changed_files: 1, title: 'Title', body: 'Criteria' };
const event = { action: 'submitted', review: { id: 10, user: { id: 8973343 }, commit_id: head }, pull_request: pr };

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'aidd-review-ci-'));
  t.after(() => process.platform === 'darwin' ? execFileSync('trash', [dir]) : rmSync(dir, { recursive: true, force: true }));
  for (const [name, value] of Object.entries({ event, pr, files: [file], comments: [] })) writeFileSync(join(dir, `${name}.json`), JSON.stringify(value));
  writeFileSync(join(dir, 'output'), '');
  const gh = join(dir, 'gh');
  writeFileSync(gh, `#!/usr/bin/env node
const fs = require('fs'); const path = require('path');
const d = process.env.FAKE_GH_DIR; const args = process.argv.slice(2); const api = args[1];
const read = (name) => JSON.parse(fs.readFileSync(path.join(d,name+'.json')));
if (args.includes('POST') || args.includes('PATCH')) { fs.writeFileSync(path.join(d,'posted.json'), fs.readFileSync(0)); console.log('{}'); }
else if (api.includes('/reviews/')) console.log(JSON.stringify(read('review')));
else if (api.includes('/files?')) console.log(JSON.stringify([read('files')]));
else if (api.includes('/comments?')) console.log(JSON.stringify([read('comments')]));
else console.log(JSON.stringify(read('pr')));
`);
  chmodSync(gh, 0o755);
  writeFileSync(join(dir, 'review.json'), JSON.stringify({ ...event.review, state: 'COMMENTED', submitted_at: '2026-11-05T00:01:00Z' }));
  const env = { ...process.env, GITHUB_RUN_ID: '123', GITHUB_SERVER_URL: 'https://github.com', OPENCODE_REVIEW_ENABLED_AT: '2026-11-05T00:00:00Z', REVIEW_NUMBER: '2', REVIEW_ID: '10', REVIEW_EVENT_PATH: join(dir, 'event.json'), PATH: `${dir}:${process.env.PATH}`, FAKE_GH_DIR: dir, GITHUB_REPOSITORY: 'owner/repo', GITHUB_EVENT_PATH: join(dir, 'event.json'), RUNNER_TEMP: dir, GITHUB_OUTPUT: join(dir, 'output') };
  const run = (command) => spawnSync(process.execPath, [script, command], { env, encoding: 'utf8' });
  const put = (name, value) => writeFileSync(join(dir, `${name}.json`), JSON.stringify(value));
  return { dir, run, put };
}
function events(dir, report) {
  const used = (tool, input, output = '') => ({ type: 'tool_use', part: { tool, state: { status: 'completed', input, output, metadata: { metadata: { truncated: false } } } } });
  const plan = JSON.parse(readFileSync(join(dir, 'opencode-review-input', 'plan.json')));
  return [
    used('skill', { id: '05-review' }),
    ...plan.inputs.map((input) => used('read', { path: join(dir, 'opencode-review', '.review-input', input.file) }, `${input.begin}\n${input.end}`)),
    ...['actions/01-prepare.md', 'actions/02-review.md', 'actions/03-conclude.md', 'references/rubric.md', 'references/axis-code.md', 'references/axis-functional.md', 'references/axis-relevancy.md', 'assets/review-template.md'].map((path) => used('read', { path: join(dir, 'opencode-review', '.opencode/skills/05-review', path) })),
    { type: 'text', part: { text: `${report}\nAIDD_REVIEW_VERDICT_V1: ${report.startsWith('Verdict: blocked') ? 'blocked' : 'approve'}\nAIDD_REVIEW_COVERAGE_V1: ${JSON.stringify({ status: 'complete', verdict: report.startsWith('Verdict: blocked') ? 'blocked' : 'approve', files: report.includes('app.js') ? ['app.js'] : [], ...(report.includes('Critical defect') ? { critical_findings: [{ file: 'app.js', line: 1, proof: 'contract broken', fix: 'repair it' }] } : {}) })}` } },
  ].map(JSON.stringify).join('\n');
}

test('publishes only after the skill and coverage, then skips an unchanged next review', (t) => {
  const f = fixture(t);
  assert.equal(f.run('prepare').status, 0);
  assert.match(readFileSync(join(f.dir, 'output'), 'utf8'), /review=true/);
  writeFileSync(join(f.dir, 'opencode-review-events.jsonl'), events(f.dir, 'Verdict: approve. Reviewed app.js.'));
  assert.equal(f.run('publish').status, 0);
  const posted = JSON.parse(readFileSync(join(f.dir, 'posted.json'), 'utf8'));
  assert.match(posted.body, /aidd-opencode-review-state:v1/);
  f.put('comments', [{ id: 12, created_at: '2026-11-05T00:00:00Z', user: { id: 41898282 }, body: posted.body }]);
  f.put('event', { ...event, review: { ...event.review, id: 11 } });
  assert.equal(f.run('prepare').status, 0);
  assert.match(readFileSync(join(f.dir, 'output'), 'utf8'), /review=false/);
});

test('refuses an incomplete blocked report without a critical finding', (t) => {
  const f = fixture(t);
  assert.equal(f.run('prepare').status, 0);
  writeFileSync(join(f.dir, 'opencode-review-events.jsonl'), events(f.dir, 'Verdict: blocked. Cannot review app.js.'));
  const result = f.run('publish');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Blocked verdict has no substantiated critical finding/);
  assert.throws(() => readFileSync(join(f.dir, 'posted.json')));
});

test('rejects events by anyone else or for a stale head', (t) => {
  const f = fixture(t);
  f.put('event', { ...event, review: { ...event.review, user: { id: 123 } } });
  assert.notEqual(f.run('prepare').status, 0);
  f.put('event', { ...event, review: { ...event.review, commit_id: sha } });
  assert.notEqual(f.run('prepare').status, 0);
});

test('does not publish when the skill was not loaded or a selected file is missing', (t) => {
  const f = fixture(t);
  assert.equal(f.run('prepare').status, 0);
  writeFileSync(join(f.dir, 'opencode-review-events.jsonl'), JSON.stringify({ type: 'text', part: { text: 'Verdict: approve app.js' } }));
  assert.match(f.run('publish').stderr, /skill was not loaded/);
  writeFileSync(join(f.dir, 'opencode-review-events.jsonl'), events(f.dir, 'Verdict: approve.'));
  assert.match(f.run('publish').stderr, /did not cover the exact selected files/);
  assert.throws(() => readFileSync(join(f.dir, 'posted.json')));
});

test('does not publish when the PR changes while OpenCode is reviewing', (t) => {
  const f = fixture(t);
  assert.equal(f.run('prepare').status, 0);
  writeFileSync(join(f.dir, 'opencode-review-events.jsonl'), events(f.dir, 'Verdict: approve. Reviewed app.js.'));
  f.put('pr', { ...pr, head: { ...pr.head, sha } });
  assert.match(f.run('publish').stderr, /PR head or base changed/);
  assert.throws(() => readFileSync(join(f.dir, 'posted.json')));
});

test('records a removed PR file without running the model, so a later reintroduction is reviewed', (t) => {
  const f = fixture(t);
  assert.equal(f.run('prepare').status, 0);
  writeFileSync(join(f.dir, 'opencode-review-events.jsonl'), events(f.dir, 'Verdict: approve. Reviewed app.js.'));
  assert.equal(f.run('publish').status, 0);
  const first = JSON.parse(readFileSync(join(f.dir, 'posted.json'), 'utf8'));
  f.put('comments', [{ id: 12, created_at: '2026-11-05T00:00:00Z', user: { id: 41898282 }, body: first.body }]);
  f.put('event', { ...event, review: { ...event.review, id: 11 } });
  f.put('pr', { ...pr, changed_files: 0 });
  f.put('files', []);
  assert.equal(f.run('prepare').status, 0);
  const removal = JSON.parse(readFileSync(join(f.dir, 'posted.json'), 'utf8'));
  assert.match(removal.body, /Verdict: approve/);
  assert.notEqual(removal.body, first.body);
  f.put('comments', [{ id: 13, created_at: '2026-11-05T00:01:00Z', user: { id: 41898282 }, body: removal.body }]);
  f.put('event', { ...event, review: { ...event.review, id: 12 } });
  f.put('pr', pr);
  f.put('files', [file]);
  assert.equal(f.run('prepare').status, 0);
  assert.equal(JSON.parse(readFileSync(join(f.dir, 'opencode-review-input', 'plan.json'))).selected[0], 'app.js');
});


test('loads the scheduled submission from GitHub and rejects stale or non-Alex reviews', (t) => {
  const f = fixture(t);
  assert.equal(f.run('event').status, 0);
  const loaded = JSON.parse(readFileSync(join(f.dir, 'event.json'), 'utf8'));
  assert.equal(loaded.review.user.id, 8973343);
  f.put('review', { ...event.review, state: 'COMMENTED', submitted_at: '2026-11-05T00:01:00Z', user: { id: 123 } });
  assert.notEqual(f.run('event').status, 0);
  f.put('review', { ...event.review, state: 'COMMENTED', submitted_at: '2026-11-05T00:01:00Z', commit_id: sha });
  assert.notEqual(f.run('event').status, 0);
});


test('records an unsuccessful run only once and only for Alex', (t) => {
  const f = fixture(t);
  assert.equal(f.run('failure').status, 0);
  const posted = JSON.parse(readFileSync(join(f.dir, 'posted.json'), 'utf8'));
  assert.match(posted.body, /aidd-opencode-review-failure:v1 10/);
  f.put('comments', [{ id: 12, created_at: '2026-11-05T00:00:00Z', user: { id: 41898282 }, body: posted.body }]);
  writeFileSync(join(f.dir, 'posted.json'), 'sentinel');
  assert.equal(f.run('failure').status, 0);
  assert.equal(readFileSync(join(f.dir, 'posted.json'), 'utf8'), 'sentinel');
  f.put('review', { ...event.review, state: 'COMMENTED', user: { id: 123 } });
  assert.notEqual(f.run('failure').status, 0);
});

test('does not repeat a queued review after an earlier run failed', (t) => {
  const f = fixture(t);
  f.put('comments', [{ id: 12, created_at: '2026-11-05T00:00:00Z', user: { id: 41898282 }, body: '<!-- aidd-opencode-review-failure:v1 10 -->' }]);
  assert.equal(f.run('prepare').status, 0);
  assert.match(readFileSync(join(f.dir, 'output'), 'utf8'), /review=false/);
});


test('publishes a complete blocked verdict with a critical finding', (t) => {
  const f = fixture(t);
  assert.equal(f.run('prepare').status, 0);
  writeFileSync(join(f.dir, 'opencode-review-events.jsonl'), events(f.dir, 'Verdict: blocked. Critical defect in app.js.'));
  assert.equal(f.run('publish').status, 0);
  const body = JSON.parse(readFileSync(join(f.dir, 'posted.json'), 'utf8')).body;
  assert.match(body, /Verdict: blocked/);
  assert.match(body, /contract broken/);
  assert.match(body, /repair it/);
});


test('rejects a report when the input was truncated even if the model claims full coverage', (t) => {
  const f = fixture(t);
  assert.equal(f.run('prepare').status, 0);
  const input = events(f.dir, 'Verdict: approve. Reviewed app.js.').split('\n').map(JSON.parse);
  const read = input.find((e) => e.part?.tool === 'read' && e.part?.state?.input?.path?.includes('diff-001.md'));
  read.part.state.output = 'only the beginning';
  writeFileSync(join(f.dir, 'opencode-review-events.jsonl'), input.map(JSON.stringify).join('\n'));
  assert.match(f.run('publish').stderr, /did not read all of diff-001.md/);
  assert.throws(() => readFileSync(join(f.dir, 'posted.json')));
});

test('splits oversized diffs on complete lines and rejects unreadably long lines', async () => {
  const { splitDiff } = await import('../opencode-review-ci.mjs');
  const chunks = splitDiff(Array.from({ length: 4000 }, () => 'x'.repeat(60)).join('\n'));
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((part) => Buffer.byteLength(part.text) < 40000 && part.text.split('\n').length < 1500));
  assert.throws(() => splitDiff('a'.repeat(2000)), /too long/);
});


test('rejects a report whose visible verdict contradicts its manifest', (t) => {
  const f = fixture(t);
  assert.equal(f.run('prepare').status, 0);
  const output = events(f.dir, 'Verdict: approve. Reviewed app.js.');
  writeFileSync(join(f.dir, 'opencode-review-events.jsonl'), output.replace('Verdict: approve.', 'Verdict: blocked. Do not approve.'));
  assert.match(f.run('publish').stderr, /Report does not match its verdict/);
  assert.throws(() => readFileSync(join(f.dir, 'posted.json')));
});

test('accepts file reads expressed relative to the review snapshot', (t) => {
  const f = fixture(t);
  assert.equal(f.run('prepare').status, 0);
  const output = events(f.dir, 'Verdict: approve. Reviewed app.js.').split('\n').map(JSON.parse);
  for (const item of output) {
    const input = item.part?.state?.input;
    if (item.part?.tool === 'read' && input?.path) input.path = input.path.replace(join(f.dir, 'opencode-review') + '/', '');
  }
  writeFileSync(join(f.dir, 'opencode-review-events.jsonl'), output.map(JSON.stringify).join('\n'));
  assert.equal(f.run('publish').status, 0);
});


test('does not mistake verdict words in file paths for the actual verdict', (t) => {
  const f = fixture(t);
  assert.equal(f.run('prepare').status, 0);
  writeFileSync(join(f.dir, 'opencode-review-events.jsonl'), events(f.dir, 'Verdict: approve. Reviewed app.js and docs/blocked.md.'));
  assert.equal(f.run('publish').status, 0);
});


test('rejects a verdict heading that conflicts with the structured result', (t) => {
  const f = fixture(t);
  assert.equal(f.run('prepare').status, 0);
  const output = events(f.dir, 'Verdict: approve. Reviewed app.js.').split('\n').map(JSON.parse);
  const text = output.find((item) => item.type === 'text');
  text.part.text = text.part.text.replace('Verdict: approve.', '## Verdict\n\nblocked');
  writeFileSync(join(f.dir, 'opencode-review-events.jsonl'), output.map(JSON.stringify).join('\n'));
  assert.match(f.run('publish').stderr, /Report does not match its verdict/);
  assert.throws(() => readFileSync(join(f.dir, 'posted.json')));
});
