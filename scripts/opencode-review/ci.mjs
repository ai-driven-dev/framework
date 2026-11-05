import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { discover, pages } from './discover.mjs';
import { planReview, stateStore, validateState } from './state.mjs';
import { fetchReviewObjects, fileModes, recoverPatches } from './git.mjs';

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

function splitReport(text) {
  const result = []; let part = '', bytes = 0;
  for (const char of text) {
    const size = Buffer.byteLength(char);
    if (bytes + size > 55_000) { result.push(part); part = ''; bytes = 0; }
    part += char; bytes += size;
  }
  if (part) result.push(part);
  return result;
}

function draftId(draft) {
  return createHash('sha256').update(JSON.stringify([draft.head, draft.base, draft.reviewId, draft.nextState, draft.chunks])).digest('hex');
}

function publishDraft({ record, store, number, root, authorId, query, queryPages, deadline, now }) {
  const draft = record.draft;
  if (!draft || !SHA.test(draft.head ?? '') || !SHA.test(draft.base ?? '') || !Number.isSafeInteger(draft.reviewId) || draft.reviewId < 1 ||
      !Array.isArray(draft.chunks) || !draft.chunks.length || draft.chunks.some((chunk) => typeof chunk !== 'string' || Buffer.byteLength(chunk) > 55_000) ||
      !draft.nextState || validateState(draft.nextState).head !== draft.head || draft.nextState.base !== draft.base || draft.nextState.reviewId !== String(draft.reviewId) || draftId(draft) !== draft.id) throw new Error('Invalid saved review draft');
  const comments = queryPages(`${root}/issues/${number}/comments?per_page=100`);
  for (const [index, chunk] of draft.chunks.entries()) {
    const marker = `<!-- aidd-opencode-review-v2 ${draft.id} ${index + 1}/${draft.chunks.length} -->`;
    const body = `## Revue OpenCode — ${index + 1}/${draft.chunks.length}\n\nCommit examiné : \`${draft.head}\` ; la PR peut avoir évolué depuis.\n\n${chunk}\n\n${marker}`;
    if (comments.some((comment) => comment?.user?.id === authorId && typeof comment.body === 'string' && comment.body.includes(marker))) continue;
    if (now() >= deadline) return { status: 'publishing' };
    assertSubmission(query, root, number, draft.reviewId);
    query(`${root}/issues/${number}/comments`, 'POST', { body });
  }
  const current = query(`${root}/pulls/${number}`);
  const stale = current.state !== 'open' || current.head?.sha !== draft.head || current.base?.sha !== draft.base;
  const state = stale ? { ...draft.nextState, pending: true } : draft.nextState;
  store.save(number, { state, draft: null });
  return { status: state.pending ? 'partial' : 'published' };
}

/** Process one submitted review. Only successfully reviewed files enter the checkpoint. */
export function reviewPullRequest(candidate, { repository, authorId, store, query = api, queryPages = pages, model = runModel, fetchObjects = fetchReviewObjects, inspectModes = fileModes, recover = recoverPatches, deadline = Infinity, now = Date.now }) {
  if (!REPO.test(repository ?? '') || !Number.isSafeInteger(candidate?.number) || candidate.number < 1 || !Number.isSafeInteger(candidate.reviewId) || candidate.reviewId < 1 || authorId !== ALEX || !store) throw new Error('Invalid review parameters');
  const root = `repos/${repository}`, number = candidate.number;
  const pr = query(`${root}/pulls/${number}`);
  const head = pr.head?.sha, base = pr.base?.sha;
  if (pr.state !== 'open' || !SHA.test(head ?? '') || !SHA.test(base ?? '')) throw new Error('Invalid open PR');
  assertSubmission(query, root, number, candidate.reviewId);
  let record = store.load(number);
  if (record.draft) {
    if (!record.draft.nextState?.atomicFiles) throw new Error('Legacy review draft requires manual migration; draft preserved');
    const savedReview = query(`${root}/pulls/${number}/reviews/${record.draft.reviewId}`);
    if (savedReview.id === record.draft.reviewId && savedReview.user?.id === ALEX && ['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED'].includes(savedReview.state)) {
      return publishDraft({ record, store, number, root, authorId, query, queryPages, deadline: deadline + 15 * 60_000, now });
    }
    record = { state: record.state, draft: null };
    store.save(number, record);
  }
  const previous = record.state;
  if (previous?.reviewId === String(candidate.reviewId) && (!previous.atomicFiles || !previous.pending)) return { status: 'already-processed' };
  if (previous?.modes && previous.atomicFiles && !previous.pending && !previous.unreviewed?.length && previous.head === head && previous.base === base) {
    assertSubmission(query, root, number, candidate.reviewId);
    const latest = query(`${root}/pulls/${number}`);
    const stale = latest.state !== 'open' || latest.head?.sha !== head || latest.base?.sha !== base;
    store.save(number, { state: { ...previous, reviewId: String(candidate.reviewId), ...(stale ? { pending: true } : {}) }, draft: null });
    return { status: stale ? 'partial' : 'unchanged' };
  }
  let files = queryPages(`${root}/pulls/${number}/files?per_page=100`);
  if (files.length !== pr.changed_files) throw new Error('Incomplete PR file list');
  const cache = files.length ? mkdtempSync(join(tmpdir(), 'aidd-opencode-review-cache-')) : null;
  try {
    let recoveryError = null;
    let mergeBase, modeSkipped = [];
    if (files.length) {
      ({ mergeBase } = fetchObjects({ repository, number, head, base, cache }));
      const inspected = inspectModes({ files, mergeBase, head, cache });
      files = inspected.files;
      modeSkipped = inspected.skipped;
    }
    const priorFiles = previous?.atomicFiles ? previous.files : {};
    let plan = planReview(files, priorFiles);
    if (plan.skipped.length) {
      try {
        const names = new Set(plan.skipped.map((item) => item.filename));
        const result = recover({ files: files.filter((file) => names.has(file.filename)), mergeBase, head, cache });
        const replacements = new Map(result.files.map((file) => [file.filename, file]));
        files = files.map((file) => replacements.get(file.filename) ?? file);
        plan = planReview(files, priorFiles);
        const reasons = new Map(result.skipped.map((item) => [item.filename, item.reason]));
        plan.skipped = plan.skipped.map((item) => ({ ...item, reason: reasons.get(item.filename) ?? item.reason }));
      } catch (error) {
        recoveryError = error;
        plan.skipped = plan.skipped.map((item) => ({ ...item, reason: 'Git recovery temporarily unavailable; retry planned' }));
      }
    }
    const context = splitInput(`Title: ${pr.title ?? ''}\n\n${pr.body ?? ''}`, 'context');
    const selected = new Set(plan.selected.map((file) => file.filename));
    const groups = [], oversized = [];
    for (const [index, file] of files.entries()) {
      if (!Object.hasOwn(plan.current, file.filename)) continue;
      if (!selected.has(file.filename) && previous?.atomicFiles) continue;
      const rawBytes = Buffer.byteLength(file.patch);
      if (rawBytes > MAX_BATCH) {
        oversized.push({ filename: file.filename, reason: `Diff trop volumineux pour une seule session (${rawBytes} octets ; limite ${MAX_BATCH})` });
        continue;
      }
      const parts = splitInput(file.patch, `diff-${String(index + 1).padStart(4, '0')}`, [file.filename]);
      for (const [partIndex, part] of parts.entries()) {
        const header = [`## ${JSON.stringify(file.filename)} (${file.status}), part ${partIndex + 1}/${parts.length}`, file.previous_filename ? `Previous path: ${JSON.stringify(file.previous_filename)}` : '', `Git mode: ${file.oldMode ?? 'absent'} → ${file.newMode ?? 'absent'}`].filter(Boolean).join('\n');
        part.text = `${header}\n\n\`\`\`diff\n${part.text}\n\`\`\``;
      }
      const bytes = parts.reduce((sum, part) => sum + Buffer.byteLength(part.text) + Buffer.byteLength(part.begin) + Buffer.byteLength(part.end) + 2, 0);
      if (bytes > MAX_BATCH) oversized.push({ filename: file.filename, reason: `Diff trop volumineux pour une seule session (${bytes} octets ; limite ${MAX_BATCH})` });
      else if (selected.has(file.filename)) groups.push({ filename: file.filename, parts, bytes });
    }
    const batches = []; let batch = [], size = 0;
    const flush = () => { if (batch.length) batches.push(batch); batch = []; size = 0; };
    for (const group of groups) {
      if (batch.length && size + group.bytes > MAX_BATCH) flush();
      batch.push(...group.parts); size += group.bytes;
    }
    if (batch.length) batches.push(batch);
    const coverage = new Map(groups.map((group) => [group.filename, false]));
    const reports = []; let modelError = null;
    let verdict = previous?.atomicFiles && previous.pending && previous.head === head && previous.base === base ? previous.verdict : undefined;
    let currentVerdict;
    for (const group of batches) {
      const names = [...new Set(group.flatMap((chunk) => chunk.files))];
      try {
        if (now() >= deadline) throw new Error('Review run time budget exhausted');
        const result = model({ inputs: [...context, ...group], files: names, repository, number, head, base, cache });
        if (!result || typeof result.report !== 'string' || !result.report.trim() || !VERDICTS.includes(result.verdict) || !Array.isArray(result.reviewed) || result.reviewed.some((name) => !names.includes(name)) || new Set(result.reviewed).size !== result.reviewed.length) throw new Error('Invalid model result');
        for (const name of result.reviewed) coverage.set(name, true);
        reports.push(result.report.trim());
        if (verdict === undefined || VERDICTS.indexOf(result.verdict) > VERDICTS.indexOf(verdict)) verdict = result.verdict;
        if (currentVerdict === undefined || VERDICTS.indexOf(result.verdict) > VERDICTS.indexOf(currentVerdict)) currentVerdict = result.verdict;
      } catch (error) {
        modelError = error;
        break;
      }
    }
    const reviewed = [...coverage].filter(([, covered]) => covered).map(([name]) => name);
    const unfinished = [...coverage].filter(([, covered]) => !covered);
    const pending = Boolean(recoveryError) || unfinished.length > 0;
    if (pending && !reviewed.length) throw modelError ?? recoveryError ?? new Error('OpenCode did not confirm any selected file');
    const notReviewed = [...modeSkipped, ...plan.skipped.map((item) => ({ filename: item.filename, reason: item.reason })), ...oversized, ...unfinished.map(([filename]) => ({ filename, reason: 'OpenCode did not confirm complete review' }))];
    const unreviewed = [...new Set(notReviewed.map(({ filename }) => filename))].sort((a, b) => String(a ?? '').localeCompare(String(b ?? '')));
    const tooLarge = new Set(oversized.map(({ filename }) => filename));
    const currentEntries = Object.entries(plan.current).filter(([name]) => !tooLarge.has(name) && (!coverage.has(name) || coverage.get(name)));
    // A skipped mode cannot validate the current file. Keep the old hash only as history;
    // unreviewed prevents a fast path until the mode and fingerprint are checked again.
    if (previous?.atomicFiles && previous.files) for (const { filename } of modeSkipped) if (typeof filename === 'string' && Object.hasOwn(previous.files, filename)) currentEntries.push([filename, previous.files[filename]]);
    const current = Object.fromEntries(currentEntries);
    const nextState = validateState({ version: 1, files: current, head, base, reviewId: String(candidate.reviewId), modes: true, atomicFiles: true, pending, ...(unreviewed.length ? { unreviewed } : {}), ...(verdict ? { verdict } : {}) });
    assertSubmission(query, root, number, candidate.reviewId);
    const sameOmissions = !pending && !previous?.pending && previous?.head === head && previous?.base === base && JSON.stringify(previous?.unreviewed ?? []) === JSON.stringify(unreviewed);
    if (!reports.length && previous && (!notReviewed.length || sameOmissions)) {
      const latest = query(`${root}/pulls/${number}`);
      const stale = latest.state !== 'open' || latest.head?.sha !== head || latest.base?.sha !== base;
      store.save(number, { state: stale ? { ...nextState, pending: true } : nextState, draft: null });
      return { status: stale ? 'partial' : 'unchanged' };
    }
    const notes = notReviewed.length ? `\n\n### Fichiers non revus\n\n${notReviewed.map(({ filename, reason }) => `- ${JSON.stringify(filename)} : ${reason}`).join('\n')}` : '';
    const summary = `${pending ? 'La revue est partielle ; les fichiers restants seront réessayés.\n\n' : notReviewed.length ? 'La revue est partielle ; certains fichiers n’ont pas été revus.\n\n' : ''}${reports.map((report, index) => `### Lot ${index + 1}/${reports.length}\n\n${report}`).join('\n\n---\n\n') || 'Aucun fichier revu dans ce passage.'}${notes}${currentVerdict ? `\n\n**Verdict des fichiers de ce commentaire : ${currentVerdict}**` : ''}${previous?.pending && previous.head === head && previous.base === base && verdict ? `\n\n**Verdict cumulé des fichiers examinés sur ce commit : ${verdict}**` : ''}`;
    const draft = { head, base, reviewId: candidate.reviewId, nextState, chunks: splitReport(summary) };
    draft.id = draftId(draft);
    record = { state: previous, draft };
    store.save(number, record);
    const publication = publishDraft({ record, store, number, root, authorId, query, queryPages, deadline: deadline + 15 * 60_000, now });
    const error = modelError ?? recoveryError;
    return { ...publication, reviewed, skipped: notReviewed, ...(error ? { error: error.message } : {}) };
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

export function run({ repository, enabledAt, store, query = api, queryPages = pages, model = runModel, retry, log = console.error, now = Date.now }) {
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
      const result = reviewPullRequest(candidate, { repository, authorId, store, query, queryPages, model, deadline, now });
      if (result.status === 'partial' || result.status === 'publishing') {
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
