import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const REPOSITORY = 'ai-driven-dev/framework';
const UTF8 = new TextDecoder('utf-8', { fatal: true });
const MAX_DIFF = 120_000;

function validSha(sha) {
  if (typeof sha !== 'string' || !SHA.test(sha)) throw new Error('Invalid Git object ID');
}

// Never inherit Git configuration, external diff, textconv, replace objects, or hooks.
function git(cache, args, maxBuffer = 256 * 1024 * 1024) {
  const env = Object.fromEntries(['HOME', 'PATH', 'TMPDIR', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY'].filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
  Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0', GIT_NO_REPLACE_OBJECTS: '1', GIT_OPTIONAL_LOCKS: '0', GIT_ATTR_NOSYSTEM: '1', LC_ALL: 'C' });
  return execFileSync('git', ['-C', join(cache, 'git'), '-c', 'core.hooksPath=/dev/null', '-c', 'core.attributesFile=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'credential.helper=', ...args], {
    env, timeout: 120_000, maxBuffer, stdio: ['ignore', 'pipe', 'pipe'],
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

/** Git supplies the complete patch and metadata; unsupported files are never credited. */
export function diffFiles({ files, mergeBase, head, cache }) {
  if (!Array.isArray(files) || !cache) throw new Error('Invalid review Git parameters');
  commit(cache, mergeBase); commit(cache, head);
  const reviewed = [], skipped = [];
  for (const file of files) {
    const name = file?.filename;
    if (typeof name !== 'string' || !name || name.includes('\0') ||
        !['added', 'removed', 'modified', 'renamed', 'copied', 'changed'].includes(file.status) ||
        ((file.status === 'renamed' || file.status === 'copied') &&
          (typeof file.previous_filename !== 'string' || !file.previous_filename || file.previous_filename.includes('\0')))) {
      skipped.push({ filename: typeof name === 'string' ? name : null, reason: 'Invalid GitHub file metadata' });
      continue;
    }
    validSha(file.sha);
    const target = file.status === 'removed' ? mergeBase : head;
    const actual = text(git(cache, ['rev-parse', '--verify', '--end-of-options', `${target}:${name}`])).trim();
    if (actual !== file.sha) throw new Error('GitHub file does not match the fetched commit');
    const paths = file.status === 'renamed' || file.status === 'copied' ? [file.previous_filename, name] : [name];
    const args = ['--literal-pathspecs', 'diff', '--no-ext-diff', '--no-textconv', '--no-color', '--find-renames=50%', '--full-index', '--ignore-submodules=none', '--submodule=short'];
    const counts = text(git(cache, [...args, '--numstat', '-z', mergeBase, head, '--', ...paths]));
    if (counts.split('\0').some((row) => row.startsWith('-\t-\t'))) {
      skipped.push({ filename: name, reason: 'Binary file has no text patch' });
      continue;
    }
    let patch;
    try {
      patch = text(git(cache, [...args, mergeBase, head, '--', ...paths], MAX_DIFF));
    } catch (error) {
      if (error.code === 'ENOBUFS') {
        skipped.push({ filename: name, reason: `Diff exceeds ${MAX_DIFF} bytes` });
        continue;
      }
      if (error instanceof TypeError) {
        skipped.push({ filename: name, reason: 'Diff is not valid UTF-8' });
        continue;
      }
      throw error;
    }
    if (patch.includes('\0')) {
      skipped.push({ filename: name, reason: 'Binary file has no text patch' });
      continue;
    }
    if (!patch) throw new Error('GitHub file has no changes in the fetched commits');
    const fingerprint = createHash('sha256').update(JSON.stringify([name, file.status, file.previous_filename ?? null, patch])).digest('hex');
    reviewed.push({ ...file, patch, fingerprint });
  }
  return { files: reviewed, skipped };
}
