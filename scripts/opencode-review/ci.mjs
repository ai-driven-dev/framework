import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { discover, pages } from './discover.mjs';
import { stateStore } from './state.mjs';
import { fetchReviewObjects, diffFiles } from './git.mjs';

const ALEX = 8973343;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const VERDICTS = ['approve', 'changes-requested', 'blocked'];
const MAX_BATCH = 120_000;
const MAX_INPUT = 32_000;
const MAX_LINE = 1_400;
const scriptDir = dirname(fileURLToPath(import.meta.url));

function api(path, method, body) {
  const args = ['api', path];
  if (method) args.push('--method', method, '--input', '-');
  return JSON.parse(execFileSync('gh', args, {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 60_000,
    ...(method ? { input: JSON.stringify(body) } : {}),
  }));
}

// Long lines are shown as explicitly marked display continuations; their characters are retained.
function wrapLines(text) {
  const lines = [];
  for (const line of text.split('\n')) {
    if (Buffer.byteLength(line) <= MAX_LINE) { lines.push(line); continue; }
    let part = '', size = 0, first = true;
    for (const char of line) {
      const bytes = Buffer.byteLength(char);
      if (size + bytes > MAX_LINE) {
        lines.push(`${first ? '' : '↳ '}${part} ⤶`);
        part = ''; size = 0; first = false;
      }
      part += char; size += bytes;
    }
    lines.push(`${first ? '' : '↳ '}${part}`);
  }
  return lines;
}

/** Create inputs small enough for the OpenCode read tool, including long source lines. */
export function splitInput(text, prefix, files = []) {
  const chunks = []; let lines = [], bytes = 0;
  const flush = () => {
    if (!lines.length) return;
    const token = randomUUID();
    chunks.push({ file: `${prefix}-${String(chunks.length + 1).padStart(3, '0')}.md`, begin: `AIDD_INPUT_BEGIN_${token}`, end: `AIDD_INPUT_END_${token}`, text: lines.join('\n'), files });
    lines = []; bytes = 0;
  };
  for (const line of wrapLines(text)) {
    const size = Buffer.byteLength(line) + 1;
    if (bytes + size > MAX_INPUT || lines.length >= 1_000) flush();
    lines.push(line); bytes += size;
  }
  flush();
  return chunks;
}

/** Validate actual OpenCode tool events; model claims alone do not prove input was read. */
export function reportFromEvents(events, files, inputs, workspace) {
  if (!Array.isArray(events) || events.some((event) => event.type === 'error')) throw new Error('OpenCode reported an error');
  const tools = events.filter((event) => event.type === 'tool_use').map((event) => event.part ?? {});
  if (!tools.some((part) => part.tool === 'skill' && part.state?.status === 'completed' && part.state?.input?.id === '05-review')) throw new Error('Review skill was not loaded');
  for (const action of ['01-prepare.md', '02-review.md', '03-conclude.md']) {
    const path = resolve(workspace, '.opencode/skills/05-review/actions', action);
    const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter((line) => line.trim());
    if (!lines.length) throw new Error(`Empty skill action ${action}`);
    if (!tools.some((part) => part.tool === 'read' && part.state?.status === 'completed' &&
      resolve(workspace, part.state?.input?.path ?? '') === path && typeof part.state?.output === 'string' &&
      part.state.output.includes(lines[0]) && part.state.output.includes(lines.at(-1)) &&
      part.state?.metadata?.metadata?.truncated !== true)) throw new Error(`Review did not read all of skill action ${action}`);
  }
  for (const input of inputs) {
    const path = resolve(workspace, '.review-input', input.file);
    const read = tools.find((part) => part.tool === 'read' && part.state?.status === 'completed' &&
      resolve(workspace, part.state?.input?.path ?? '') === path && typeof part.state?.output === 'string' &&
      part.state.output.includes(input.begin) && part.state.output.includes(input.end) && part.state?.metadata?.metadata?.truncated !== true);
    if (!read) throw new Error(`OpenCode did not read all of ${input.file}`);
  }
  const output = events.filter((event) => event.type === 'text').map((event) => event.part?.text).filter(Boolean).at(-1) ?? '';
  const matches = [...output.matchAll(/^AIDD_REVIEW_COVERAGE_V1:\s*(\{.*\})\s*$/gm)];
  if (matches.length !== 1) throw new Error('Missing review coverage');
  let coverage;
  try { coverage = JSON.parse(matches[0][1]); } catch { throw new Error('Invalid review coverage'); }
  if (!Array.isArray(coverage.reviewed) || coverage.reviewed.some((name) => typeof name !== 'string' || !files.includes(name)) || new Set(coverage.reviewed).size !== coverage.reviewed.length) throw new Error('Invalid reviewed file list');
  if (!VERDICTS.includes(coverage.verdict)) throw new Error('Invalid review verdict');
  const report = output.replace(matches[0][0], '').trim();
  if (!report) throw new Error('Empty review report');
  return { report, reviewed: coverage.reviewed, verdict: coverage.verdict };
}

/** Run a separate trusted shell. The child never receives the GitHub token or unrelated secrets. */
function discard(path) {
  if (process.platform === 'darwin') execFileSync('trash', [path]);
  else rmSync(path, { recursive: true, force: true });
}

export function runModel({ inputs, files, repository, number, head, base, cache }) {
  const workspace = mkdtempSync(join(tmpdir(), 'aidd-opencode-review-'));
  try {
    const inputDir = join(workspace, '.review-input');
    mkdirSync(inputDir, { recursive: true });
    for (const input of inputs) writeFileSync(join(inputDir, input.file), `${input.begin}\n${input.text}\n${input.end}\n`);
    const env = Object.fromEntries(['HOME', 'PATH', 'LANG', 'LC_ALL', 'TMPDIR', 'TZ', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME', 'SSL_CERT_FILE', 'SSL_CERT_DIR'].filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
    Object.assign(env, { OPENCODE_PURE: '1', REVIEW_REPOSITORY: repository, REVIEW_NUMBER: String(number), REVIEW_HEAD: head, REVIEW_BASE: base, REVIEW_CACHE: cache });
    execFileSync('bash', [join(scriptDir, 'review.sh'), workspace], { cwd: workspace, env, stdio: ['ignore', 'ignore', 'inherit'], timeout: 15 * 60 * 1000 });
    const events = readFileSync(join(workspace, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
    const result = reportFromEvents(events, files, inputs, workspace);
    if (existsSync(join(cache, 'snapshot', '.aidd-context-incomplete'))) {
      result.report += '\n\n**Limite :** le contexte source était incomplet ; la revue repose sur les diffs fournis.';
    }
    return result;
  } finally {
    discard(workspace);
  }
}

function assertSubmission(query, root, number, reviewId) {
  const submission = query(`${root}/pulls/${number}/reviews/${reviewId}`);
  if (submission.id !== reviewId || submission.user?.id !== ALEX || !['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED'].includes(submission.state)) throw new Error('Review is no longer a submission by Alex');
}

// A single durable draft makes publication idempotent if GitHub accepts a POST
// but its response is lost. Do not discard an older, incompatible draft.
function publishDraft({ record, store, number, root, authorId, query, queryPages }) {
  const { draft } = record;
  if (typeof draft?.body !== 'string' || typeof draft.id !== 'string' || !draft.nextState) throw new Error('Review draft requires manual migration; draft preserved');
  if (Buffer.byteLength(draft.body) > 60_000) throw new Error('Review report exceeds the GitHub comment limit; draft preserved');
  const marker = `<!-- aidd-opencode-review-v3 ${draft.id} -->`;
  const comments = queryPages(`${root}/issues/${number}/comments?per_page=100`);
  if (!comments.some((comment) => comment?.user?.id === authorId && typeof comment.body === 'string' && comment.body.includes(marker))) {
    assertSubmission(query, root, number, draft.reviewId);
    query(`${root}/issues/${number}/comments`, 'POST', { body: `${draft.body}\n\n${marker}` });
  }
  const pr = query(`${root}/pulls/${number}`);
  const stale = pr.state !== 'open' || pr.head?.sha !== draft.head || pr.base?.sha !== draft.base;
  const state = stale ? { ...draft.nextState, pending: true } : draft.nextState;
  store.save(number, { state, draft: null });
  return { status: state.pending ? 'partial' : 'published', ...(draft.error ? { error: draft.error } : {}) };
}

const inputSize = (input) => Buffer.byteLength(input.text) + Buffer.byteLength(input.begin) + Buffer.byteLength(input.end) + 2;

function saveUnchanged({ store, number, state, query, root }) {
  assertSubmission(query, root, number, Number(state.reviewId));
  const pr = query(`${root}/pulls/${number}`);
  const stale = pr.state !== 'open' || pr.head?.sha !== state.head || pr.base?.sha !== state.base;
  store.save(number, { state: stale ? { ...state, pending: true } : state, draft: null });
  return { status: stale ? 'partial' : 'unchanged' };
}

/** Process one submitted review. Only files read and reported enter the checkpoint. */
export function reviewPullRequest(candidate, { repository, authorId, store, query = api, queryPages = pages, model = runModel, fetchObjects = fetchReviewObjects, getDiffs = diffFiles, deadline = Infinity, now = Date.now }) {
  if (!REPO.test(repository ?? '') || !Number.isSafeInteger(candidate?.number) || candidate.number < 1 || !Number.isSafeInteger(candidate.reviewId) || candidate.reviewId < 1 || authorId !== ALEX || !store) throw new Error('Invalid review parameters');
  const root = `repos/${repository}`, number = candidate.number;
  const pr = query(`${root}/pulls/${number}`);
  const head = pr.head?.sha, base = pr.base?.sha;
  if (pr.state !== 'open' || !SHA.test(head ?? '') || !SHA.test(base ?? '')) throw new Error('Invalid open PR');
  assertSubmission(query, root, number, candidate.reviewId);
  let record = store.load(number);
  if (record.draft) {
    if (typeof record.draft.body !== 'string' || !Number.isSafeInteger(record.draft.reviewId)) throw new Error('Review draft requires manual migration; draft preserved');
    const savedReview = query(`${root}/pulls/${number}/reviews/${record.draft.reviewId}`);
    if (savedReview.id !== record.draft.reviewId || savedReview.user?.id !== ALEX) throw new Error('Invalid saved review; draft preserved');
    if (savedReview.state === 'DISMISSED') {
      record = { state: record.state, draft: null };
      store.save(number, record);
    } else {
      return publishDraft({ record, store, number, root, authorId, query, queryPages });
    }
  }
  const previous = record.state;
  if (previous?.reviewId === String(candidate.reviewId) && !previous.pending) return { status: 'already-processed' };
  if (previous && !previous.pending && !previous.unreviewed?.length && previous.head === head && previous.base === base) {
    return saveUnchanged({ store, number, state: { ...previous, reviewId: String(candidate.reviewId) }, query, root });
  }
  const listed = queryPages(`${root}/pulls/${number}/files?per_page=100`);
  if (listed.length !== pr.changed_files) throw new Error('Incomplete PR file list');
  const cache = listed.length ? mkdtempSync(join(tmpdir(), 'aidd-opencode-review-cache-')) : null;
  try {
    const { mergeBase } = listed.length ? fetchObjects({ repository, number, head, base, cache }) : {};
    const { files, skipped } = listed.length ? getDiffs({ files: listed, mergeBase, head, cache }) : { files: [], skipped: [] };
    const context = splitInput(`Title: ${pr.title ?? ''}\n\n${pr.body ?? ''}`, 'context');
    const contextBytes = context.reduce((sum, part) => sum + inputSize(part), 0);
    const current = Object.fromEntries(files.filter((file) => Object.hasOwn(previous?.files ?? {}, file.filename) && previous.files[file.filename] === file.fingerprint).map((file) => [file.filename, file.fingerprint]));
    const groups = [], omitted = [...skipped];
    for (const [index, file] of files.entries()) {
      if (Object.hasOwn(current, file.filename)) continue;
      const parts = splitInput(file.patch, `diff-${String(index + 1).padStart(4, '0')}`, [file.filename]);
      for (const part of parts) part.text = `## ${JSON.stringify(file.filename)} (${file.status})\n\n\`\`\`diff\n${part.text}\n\`\`\``;
      const size = parts.reduce((sum, part) => sum + inputSize(part), 0);
      if (contextBytes + size > MAX_BATCH) omitted.push({ filename: file.filename, reason: 'Diff trop volumineux pour une seule session' });
      else groups.push({ file, parts, size });
    }
    const batches = []; let batch = [], size = contextBytes;
    for (const group of groups) {
      if (batch.length && size + group.size > MAX_BATCH) { batches.push(batch); batch = []; size = contextBytes; }
      batch.push(group); size += group.size;
    }
    if (batch.length) batches.push(batch);
    const reports = [], reviewed = []; let error = null;
    // Publish and checkpoint each lot before the timer continues with the next.
    for (const batch of batches.slice(0, 1)) {
      const names = batch.map(({ file }) => file.filename);
      try {
        if (now() >= deadline) throw new Error('Review run time budget exhausted');
        const result = model({ inputs: [...context, ...batch.flatMap(({ parts }) => parts)], files: names, repository, number, head, base, cache });
        if (!result || typeof result.report !== 'string' || !result.report.trim() || !VERDICTS.includes(result.verdict) || !Array.isArray(result.reviewed) || result.reviewed.some((name) => !names.includes(name)) || new Set(result.reviewed).size !== result.reviewed.length) throw new Error('Invalid model result');
        for (const group of batch) if (result.reviewed.includes(group.file.filename)) {
          Object.defineProperty(current, group.file.filename, { value: group.file.fingerprint, enumerable: true, configurable: true });
          reviewed.push(group.file.filename);
        }
        reports.push(`### Lot ${reports.length + 1}\n\n${result.report.trim()}\n\n**Verdict de ce lot : ${result.verdict}**`);
      } catch (cause) { error = cause; break; }
    }
    const attempted = batches[0] ?? [];
    const failed = attempted.filter(({ file }) => !Object.hasOwn(current, file.filename));
    const unfinished = groups.filter(({ file }) => !Object.hasOwn(current, file.filename));
    const pending = unfinished.length > 0;
    if (pending && !reviewed.length) throw error ?? new Error('OpenCode did not confirm any selected file');
    const unreviewed = [...new Set(omitted.map(({ filename }) => filename))].sort((a, b) => String(a ?? '').localeCompare(String(b ?? '')));
    const nextState = { version: 1, files: current, head, base, reviewId: String(candidate.reviewId), atomicFiles: true, ...(pending ? { pending: true } : {}), ...(unreviewed.length ? { unreviewed } : {}) };
    const sameOmissions = !pending && previous?.head === head && previous?.base === base && JSON.stringify(previous?.unreviewed ?? []) === JSON.stringify(unreviewed);
    if (!reports.length && previous && (!omitted.length || sameOmissions)) {
      return saveUnchanged({ store, number, state: nextState, query, root });
    }
    const known = previous?.head === head && previous?.base === base ? new Set(previous.unreviewed ?? []) : new Set();
    const notesList = [...omitted.filter(({ filename }) => !known.has(filename)), ...failed.map(({ file }) => ({ filename: file.filename, reason: 'OpenCode did not confirm complete review; retry planned' }))];
    const notes = notesList.length ? `\n\n### Fichiers non revus\n\n${notesList.map(({ filename, reason }) => `- ${JSON.stringify(filename)} : ${reason}`).join('\n')}` : '';
    const body = `## Revue OpenCode\n\nCommit examiné : \`${head}\` ; la PR peut avoir évolué depuis.\n\n${pending ? 'La revue est partielle ; les fichiers restants seront réessayés.\n\n' : omitted.length ? 'La revue est partielle.\n\n' : ''}${reports.join('\n\n---\n\n') || 'Aucun fichier revu dans ce passage.'}${notes}`;
    if (Buffer.byteLength(body) > 60_000) throw new Error('Review report exceeds the GitHub comment limit; state preserved');
    const id = createHash('sha256').update(JSON.stringify([candidate.reviewId, head, base, nextState, body])).digest('hex');
    const draft = { head, base, reviewId: candidate.reviewId, nextState, body, id, ...(failed.length ? { error: error?.message ?? 'OpenCode did not confirm all files in the lot' } : {}) };
    store.save(number, { state: previous, draft });
    const publication = publishDraft({ record: { state: previous, draft }, store, number, root, authorId, query, queryPages });
    return { ...publication, reviewed, skipped: notesList };
  } finally {
    if (cache) discard(cache);
  }
}

/** Exponential cooldown prevents paid retries every five minutes while allowing recovery. */
export function retryStore(path, now = Date.now) {
  let data = {};
  try { data = JSON.parse(readFileSync(path, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const save = () => {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const temporary = `${path}.${process.pid}`;
    writeFileSync(temporary, JSON.stringify(data), { mode: 0o600 });
    renameSync(temporary, path);
  };
  return {
    ready: (key) => !data[key] || data[key].next <= now(),
    success: (key) => { if (data[key]) { delete data[key]; save(); } },
    failure: (key) => {
      const count = Math.min((data[key]?.count ?? 0) + 1, 5);
      data[key] = { count, next: now() + Math.min(60, 5 * 2 ** (count - 1)) * 60_000 };
      save();
    },
  };
}

export function run({ repository, enabledAt, store, query = api, queryPages = pages, model = runModel, review = reviewPullRequest, retry, log = console.error, now = Date.now }) {
  if (!REPO.test(repository ?? '') || !Number.isFinite(Date.parse(enabledAt)) || !store) throw new Error('Invalid repository, activation time or state store');
  const deadline = now() + 40 * 60_000;
  const authorId = query('user').id;
  if (authorId !== ALEX) throw new Error('GitHub must be authenticated as Alex');
  const candidates = discover({ repository, enabledAt, authorId, store, queryPages, onError: log });
  for (const candidate of candidates) {
    if (now() >= deadline) { log('Review run time budget exhausted; remaining PRs will be retried'); break; }
    const key = `${candidate.number}:${candidate.reviewId}:${candidate.head}:${candidate.base}`;
    if (retry && !retry.ready(key)) continue;
    try {
      const result = review(candidate, { repository, authorId, store, query, queryPages, model, deadline, now });
      if (result.error) {
        retry?.failure(key);
        log(`PR #${candidate.number}: partial review; remaining files will be retried${result.error ? `: ${result.error}` : ''}`);
      } else retry?.success(key);
    } catch (error) {
      retry?.failure(key);
      log(`PR #${candidate.number}: ${error.message}`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const repository = process.env.OPENCODE_REVIEW_REPOSITORY;
  const directory = process.env.OPENCODE_REVIEW_STATE_DIR;
  const store = stateStore(directory, repository);
  run({ repository, enabledAt: process.env.OPENCODE_REVIEW_ENABLED_AT, store, retry: retryStore(join(directory, 'retries.json')) });
}
