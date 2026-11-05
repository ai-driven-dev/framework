import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const REPOSITORY = 'ai-driven-dev/framework';
const UTF8 = new TextDecoder('utf-8', { fatal: true });

function validSha(sha) {
  if (typeof sha !== 'string' || !SHA.test(sha)) throw new Error('Invalid Git object ID');
}

function validPath(path) {
  if (typeof path !== 'string' || !path || path.includes('\0')) throw new Error('Invalid Git path');
}

// Never inherit Git config, external diff, textconv, replace objects, or hooks from the host.
function git(cache, args, input) {
  const env = Object.fromEntries(['HOME', 'PATH', 'TMPDIR', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY'].filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
  Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0', GIT_NO_REPLACE_OBJECTS: '1', GIT_OPTIONAL_LOCKS: '0', GIT_ATTR_NOSYSTEM: '1' });
  return execFileSync('git', ['-C', join(cache, 'git'), '-c', 'core.hooksPath=/dev/null', '-c', 'core.attributesFile=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'credential.helper=', ...args], {
    env, input, timeout: 120_000, maxBuffer: 256 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function text(buffer) { return UTF8.decode(buffer); }
function commit(cache, sha) {
  validSha(sha);
  const actual = text(git(cache, ['rev-parse', '--verify', '--end-of-options', `${sha}^{commit}`])).trim();
  if (actual !== sha) throw new Error('Git commit does not match expected SHA');
}

/** Fetch PR objects into an explicit temporary bare cache, and reject a moved PR head. */
export function fetchReviewObjects({ repository, number, base, head, cache }) {
  if (repository !== REPOSITORY || !Number.isSafeInteger(number) || number < 1 || !cache || !resolve(cache)) throw new Error('Invalid review Git parameters');
  validSha(base); validSha(head);
  if (base.length !== head.length) throw new Error('Incompatible Git object formats');
  mkdirSync(join(cache, 'git'), { recursive: true });
  git(cache, ['init', '--bare', '--quiet', `--object-format=${base.length === 64 ? 'sha256' : 'sha1'}`, '.']);
  git(cache, ['fetch', '--quiet', '--no-tags', '--no-recurse-submodules', '--no-write-fetch-head', `https://github.com/${REPOSITORY}.git`, base, `+refs/pull/${number}/head:refs/aidd-review/head`]);
  commit(cache, base); commit(cache, head);
  const fetched = text(git(cache, ['rev-parse', '--verify', 'refs/aidd-review/head^{commit}'])).trim();
  if (fetched !== head) throw new Error('PR head changed during Git fetch');
  const mergeBase = text(git(cache, ['merge-base', base, head])).trim();
  validSha(mergeBase); commit(cache, mergeBase);
  return { mergeBase };
}

function blob(cache, tree, path) {
  validPath(path);
  const id = text(git(cache, ['rev-parse', '--verify', '--end-of-options', `${tree}:${path}`])).trim();
  validSha(id);
  if (text(git(cache, ['cat-file', '-t', id])).trim() !== 'blob') throw new Error('Path is not a file blob');
  return id;
}

function mode(cache, tree, path) {
  const rows = text(git(cache, ['--literal-pathspecs', 'ls-tree', '-z', tree, '--', path])).split('\0').filter(Boolean);
  const row = rows.find((entry) => entry.slice(entry.indexOf('\t') + 1) === path);
  const found = /^(\d{6}) blob [0-9a-f]+\t/.exec(row ?? '');
  if (!found) throw new Error('Cannot read file mode');
  return found[1];
}

/** Recover complete text diffs without checking out or executing any PR content. */
export function recoverPatches({ files, mergeBase, head, cache }) {
  if (!Array.isArray(files) || !cache) throw new Error('Invalid review Git parameters');
  commit(cache, mergeBase); commit(cache, head);
  const empty = text(git(cache, ['hash-object', '-w', '--stdin'], '')).trim();
  const recovered = [], skipped = [];
  for (const file of files) {
    try {
      validPath(file?.filename);
      if (!['added', 'removed', 'modified', 'renamed', 'copied', 'changed'].includes(file.status)) throw new Error('Unsupported file status');
      const oldPath = file.status === 'renamed' || file.status === 'copied' ? file.previous_filename : file.filename;
      const oldId = file.status === 'added' ? empty : blob(cache, mergeBase, oldPath);
      const newId = file.status === 'removed' ? empty : blob(cache, head, file.filename);
      const expected = file.status === 'removed' ? oldId : newId;
      validSha(file.sha);
      if (file.sha !== expected) throw new Error('File blob does not match GitHub SHA');
      if (oldId === newId) {
        const oldMode = file.status === 'added' ? null : mode(cache, mergeBase, oldPath);
        const newMode = file.status === 'removed' ? null : mode(cache, head, file.filename);
        if (oldPath === file.filename && oldMode === newMode) throw new Error('File has no text or metadata changes');
        const details = JSON.stringify({ status: file.status, oldPath: file.status === 'added' ? null : oldPath, newPath: file.status === 'removed' ? null : file.filename, oldMode, newMode });
        recovered.push({ ...file, patch: `@@ -0,0 +0,0 @@ metadata-only ${details}`, additions: 0, deletions: 0 });
        continue;
      }
      const options = ['--no-ext-diff', '--no-textconv', '--no-color', '--no-renames'];
      const counts = text(git(cache, ['diff', ...options, '--numstat', oldId, newId])).trim().split('\t');
      if (counts[0] === '-' || counts[1] === '-') throw new Error('Binary file has no text patch');
      const additions = Number(counts[0]), deletions = Number(counts[1]);
      if (!Number.isSafeInteger(additions) || !Number.isSafeInteger(deletions) || additions < 0 || deletions < 0) throw new Error('Invalid Git diff counts');
      const diff = text(git(cache, ['diff', ...options, '--unified=3', oldId, newId]));
      const firstHunk = diff.search(/^@@ -/m);
      if (firstHunk < 0) throw new Error('File has no text changes');
      recovered.push({ ...file, patch: diff.slice(firstHunk).replace(/\n$/, ''), additions, deletions });
    } catch (error) {
      const reason = error instanceof TypeError ? 'File is not valid UTF-8' : error?.message?.startsWith('Command failed:') ? 'Git could not read or diff this file' : error?.message ?? 'Cannot recover file patch';
      skipped.push({ filename: typeof file?.filename === 'string' ? file.filename : null, reason });
    }
  }
  return { files: recovered, skipped };
}
