import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

const HASH = /^[a-f0-9]{64}$/;
const OBJECT_ID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const STATUSES = new Set(['added', 'removed', 'modified', 'renamed', 'copied', 'changed', 'unchanged']);

function invalid(message) {
  throw new Error(`Invalid review state: ${message}`);
}

function validateFiles(files) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) invalid('files must be an object');
  for (const [name, hash] of Object.entries(files)) {
    if (!name || name.includes('\0') || typeof hash !== 'string' || !HASH.test(hash)) invalid('invalid file fingerprint');
  }
}

// GitHub's patch may be missing or truncated for large or binary files. Validate both each
// hunk's old/new line counts and the API's totals; never record uncertain content as reviewed.
function validatePatch(file) {
  if (typeof file.patch !== 'string' || !file.patch || !Number.isSafeInteger(file.additions) || file.additions < 0 || !Number.isSafeInteger(file.deletions) || file.deletions < 0) {
    invalid(`missing patch or counts for ${file.filename}`);
  }
  const lines = file.patch.split('\n');
  if (lines.at(-1) === '') lines.pop();
  let oldLeft = 0, newLeft = 0, additions = 0, deletions = 0, hunks = 0;
  for (const line of lines) {
    const hunk = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?:.*)$/.exec(line);
    if (hunk) {
      if (hunks && (oldLeft !== 0 || newLeft !== 0)) invalid(`incomplete hunk for ${file.filename}`);
      oldLeft = Number(hunk[2] ?? 1);
      newLeft = Number(hunk[4] ?? 1);
      if (!Number.isSafeInteger(oldLeft) || !Number.isSafeInteger(newLeft)) invalid(`invalid hunk for ${file.filename}`);
      hunks++;
      continue;
    }
    if (!hunks) invalid(`missing hunk header for ${file.filename}`);
    if (line === '\\ No newline at end of file') continue;
    if (line.startsWith(' ')) { oldLeft--; newLeft--; }
    else if (line.startsWith('+')) { newLeft--; additions++; }
    else if (line.startsWith('-')) { oldLeft--; deletions++; }
    else invalid(`invalid patch line for ${file.filename}`);
    if (oldLeft < 0 || newLeft < 0) invalid(`invalid hunk length for ${file.filename}`);
  }
  if (!hunks || oldLeft !== 0 || newLeft !== 0 || additions !== file.additions || deletions !== file.deletions) {
    invalid(`incomplete patch for ${file.filename}`);
  }
}

/** Select changes against the latest complete successful review, never the whole history. */
export function planReview(files, previous = {}) {
  if (!Array.isArray(files)) invalid('PR files must be an array');
  validateFiles(previous);
  const currentEntries = [], selected = [], skipped = [], names = new Set(), counts = new Map();
  for (const file of files) {
    if (typeof file?.filename === 'string' && file.filename) counts.set(file.filename, (counts.get(file.filename) ?? 0) + 1);
  }
  for (const file of files) {
    const filename = typeof file?.filename === 'string' && file.filename ? file.filename : null;
    if (filename) names.add(filename);
    try {
      if (!filename || filename.includes('\0') || counts.get(filename) !== 1) invalid('missing or duplicate filename');
      if (!STATUSES.has(file.status) || typeof file.sha !== 'string' || !OBJECT_ID.test(file.sha)) invalid(`invalid file metadata for ${filename}`);
      if (file.previous_filename !== undefined && file.previous_filename !== null && (typeof file.previous_filename !== 'string' || !file.previous_filename || file.previous_filename.includes('\0'))) invalid(`invalid previous filename for ${filename}`);
      if ((file.status === 'renamed' || file.status === 'copied') && !file.previous_filename) invalid(`missing previous filename for ${filename}`);
      if (Object.hasOwn(file, 'oldMode') || Object.hasOwn(file, 'newMode')) {
        for (const mode of [file.oldMode, file.newMode]) if (mode !== null && (typeof mode !== 'string' || !/^[0-7]{6}$/.test(mode))) invalid(`invalid Git mode for ${filename}`);
      }
      validatePatch(file);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith('Invalid review state: ')) throw error;
      skipped.push({ filename, reason: error.message.slice('Invalid review state: '.length) });
      continue;
    }
    const fingerprint = createHash('sha256').update(JSON.stringify([file.filename, file.status, file.sha, file.previous_filename ?? null, file.oldMode ?? null, file.newMode ?? null, file.patch])).digest('hex');
    currentEntries.push([file.filename, fingerprint]);
    if (!Object.hasOwn(previous, file.filename) || previous[file.filename] !== fingerprint) selected.push(file);
  }
  const current = Object.fromEntries(currentEntries);
  const removed = Object.keys(previous).filter((name) => !names.has(name));
  return { selected, current, removed, skipped };
}

export function validateState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state) || state.version !== 1) invalid('unknown marker version');
  if (typeof state.head !== 'string' || !OBJECT_ID.test(state.head)) invalid('invalid head');
  if (state.base !== undefined && (typeof state.base !== 'string' || !OBJECT_ID.test(state.base))) invalid('invalid base');
  if (typeof state.reviewId !== 'string' || !/^[1-9][0-9]*$/.test(state.reviewId)) invalid('invalid review ID');
  if (state.pending !== undefined && typeof state.pending !== 'boolean') invalid('invalid pending flag');
  if (state.modes !== undefined && typeof state.modes !== 'boolean') invalid('invalid modes flag');
  if (state.atomicFiles !== undefined && typeof state.atomicFiles !== 'boolean') invalid('invalid atomic-files flag');
  validateFiles(state.files);
  if (state.unreviewed !== undefined && (!Array.isArray(state.unreviewed) || new Set(state.unreviewed).size !== state.unreviewed.length ||
      state.unreviewed.some((name) => name !== null && (typeof name !== 'string' || !name || name.includes('\0'))))) invalid('invalid unreviewed files');
  if (state.verdict !== undefined && !['approve', 'changes-requested', 'blocked'].includes(state.verdict)) invalid('invalid verdict');
  return { version: 1, head: state.head, ...(state.base ? { base: state.base } : {}), reviewId: state.reviewId, files: state.files, ...(state.modes ? { modes: true } : {}), ...(state.atomicFiles ? { atomicFiles: true } : {}), ...(state.pending ? { pending: true } : {}), ...(state.unreviewed?.length ? { unreviewed: state.unreviewed } : {}), ...(state.verdict ? { verdict: state.verdict } : {}) };
}

/** Private durable state and write-ahead draft, one atomic file per repository and PR. */
export function stateStore(directory, repository) {
  if (typeof directory !== 'string' || !isAbsolute(directory) || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '')) invalid('invalid state directory or repository');
  const root = join(directory, ...repository.split('/'));
  const path = (number) => {
    if (!Number.isSafeInteger(number) || number < 1) invalid('invalid PR number');
    return join(root, `${number}.json`);
  };
  return {
    load(number) {
      let record;
      try { record = JSON.parse(readFileSync(path(number), 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') return { state: null, draft: null }; throw error; }
      if (!record || typeof record !== 'object' || Array.isArray(record) || !Object.hasOwn(record, 'state') || !Object.hasOwn(record, 'draft')) invalid('invalid stored record');
      return { state: record.state === null ? null : validateState(record.state), draft: record.draft };
    },
    save(number, record) {
      if (!record || typeof record !== 'object' || !Object.hasOwn(record, 'state') || !Object.hasOwn(record, 'draft')) invalid('invalid stored record');
      if (record.state !== null) validateState(record.state);
      const target = path(number);
      mkdirSync(root, { recursive: true, mode: 0o700 });
      const temporary = `${target}.${randomUUID()}.tmp`;
      writeFileSync(temporary, JSON.stringify(record), { mode: 0o600, flag: 'wx' });
      renameSync(temporary, target);
    },
  };
}
