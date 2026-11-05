import { createHash } from 'node:crypto';

const BOT_ID = 41898282;
const MARKER_FAMILY = '<!-- aidd-opencode-review-state:';
const MARKER_PREFIX = `${MARKER_FAMILY}v1 `;
const MARKER = /^<!-- aidd-opencode-review-state:v1 ([A-Za-z0-9_-]+) -->$/;
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
  const currentEntries = [], selected = [], names = new Set();
  for (const file of files) {
    if (!file || typeof file !== 'object' || typeof file.filename !== 'string' || !file.filename || file.filename.includes('\0') || names.has(file.filename)) invalid('missing or duplicate filename');
    if (!STATUSES.has(file.status) || typeof file.sha !== 'string' || !OBJECT_ID.test(file.sha)) invalid(`invalid file metadata for ${file.filename}`);
    if (file.previous_filename !== undefined && file.previous_filename !== null && (typeof file.previous_filename !== 'string' || !file.previous_filename || file.previous_filename.includes('\0'))) invalid(`invalid previous filename for ${file.filename}`);
    if ((file.status === 'renamed' || file.status === 'copied') && !file.previous_filename) invalid(`missing previous filename for ${file.filename}`);
    validatePatch(file);
    names.add(file.filename);
    const fingerprint = createHash('sha256').update(JSON.stringify([file.filename, file.status, file.sha, file.previous_filename ?? null, file.patch])).digest('hex');
    currentEntries.push([file.filename, fingerprint]);
    if (!Object.hasOwn(previous, file.filename) || previous[file.filename] !== fingerprint) selected.push(file);
  }
  const current = Object.fromEntries(currentEntries);
  const removed = Object.keys(previous).filter((name) => !names.has(name));
  return { selected, current, removed };
}

function validateState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state) || state.version !== 1) invalid('unknown marker version');
  if (typeof state.head !== 'string' || !OBJECT_ID.test(state.head)) invalid('invalid head');
  if (typeof state.reviewId !== 'string' || !/^[1-9][0-9]*$/.test(state.reviewId)) invalid('invalid review ID');
  validateFiles(state.files);
  return { version: 1, head: state.head, reviewId: state.reviewId, files: state.files };
}

/** Append this marker only after a successful, complete review, in the bot's own comment. */
export function encodeReviewState({ files, head, reviewId }) {
  const state = validateState({ version: 1, files, head, reviewId: String(reviewId) });
  return `${MARKER_PREFIX}${Buffer.from(JSON.stringify(state)).toString('base64url')} -->`;
}

/** Read only the latest complete marker from the GitHub Actions bot, independent of API order. */
export function latestReviewState(comments) {
  if (!Array.isArray(comments)) invalid('comments must be an array');
  const candidates = comments.filter((comment) => comment?.user?.id === BOT_ID && typeof comment.body === 'string' && comment.body.trimEnd().split(/\r?\n/).at(-1).startsWith(MARKER_FAMILY));
  for (const comment of candidates) {
    if (!Number.isSafeInteger(comment.id) || comment.id < 1 || typeof comment.created_at !== 'string' || !Number.isFinite(Date.parse(comment.created_at))) invalid('invalid marker comment');
  }
  candidates.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id);
  if (!candidates.length) return null;
  // Only the orchestrator's final line is metadata; the report may quote older markers.
  const trailer = candidates[0].body.trimEnd().split(/\r?\n/).at(-1);
  const match = MARKER.exec(trailer);
  if (!match) invalid('malformed marker');
  const encoded = match[1];
  let state;
  try {
    const bytes = Buffer.from(encoded, 'base64url');
    if (bytes.toString('base64url') !== encoded) invalid('invalid marker encoding');
    state = JSON.parse(bytes.toString('utf8'));
  } catch {
    invalid('malformed marker payload');
  }
  return validateState(state);
}
