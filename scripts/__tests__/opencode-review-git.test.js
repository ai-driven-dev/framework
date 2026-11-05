const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { fileModes, recoverPatches } = require('../opencode-review/git.mjs');
const { planReview } = require('../opencode-review/state.mjs');

test('recovers literal paths, renames and long lines without running repository commands', (t) => {
  const cache = mkdtempSync(join(tmpdir(), 'aidd-review-git-'));
  t.after(() => process.platform === 'darwin' ? execFileSync('trash', [cache]) : rmSync(cache, { recursive: true, force: true }));
  const repo = join(cache, 'git');
  mkdirSync(repo);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  Object.assign(env, { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' });
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', env }).trim();
  git('init', '-q');
  git('config', 'user.name', 'Review fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  const unusual = ':(literal)*[name].txt';
  const long = 'é'.repeat(4000);
  writeFileSync(join(repo, unusual), 'before\n');
  writeFileSync(join(repo, 'old name.txt'), 'rename old\n');
  writeFileSync(join(repo, 'same-old.txt'), 'same content\n');
  writeFileSync(join(repo, 'mode.txt'), 'same content\n');
  writeFileSync(join(repo, 'mode-content.txt'), 'before\n');
  writeFileSync(join(repo, 'converted.txt'), 'regular file\n');
  writeFileSync(join(repo, 'long.txt'), 'old line\n');
  writeFileSync(join(repo, 'removed.txt'), 'gone\n');
  writeFileSync(join(repo, 'empty-removed.txt'), '');
  writeFileSync(join(repo, 'binary.bin'), Buffer.from([0, 1, 2]));
  git('add', '--all');
  git('update-index', '--add', '--cacheinfo', `160000,${'a'.repeat(40)},vendor/existing`);
  git('update-index', '--add', '--cacheinfo', `160000,${'c'.repeat(40)},vendor/removed`);
  git('commit', '-qm', 'base');
  const base = git('rev-parse', 'HEAD');
  writeFileSync(join(repo, unusual), 'after\n');
  git('mv', 'old name.txt', 'new name.txt');
  git('mv', 'same-old.txt', 'same-new.txt');
  chmodSync(join(repo, 'mode.txt'), 0o755);
  chmodSync(join(repo, 'mode-content.txt'), 0o755);
  writeFileSync(join(repo, 'mode-content.txt'), 'after\n');
  writeFileSync(join(repo, 'new name.txt'), 'rename new\n');
  writeFileSync(join(repo, 'long.txt'), `${long}\n`);
  git('rm', '-q', 'removed.txt');
  git('rm', '-q', 'empty-removed.txt');
  writeFileSync(join(repo, 'added.txt'), 'added\n');
  writeFileSync(join(repo, 'empty-added.txt'), '');
  writeFileSync(join(repo, 'binary.bin'), Buffer.from([0, 3, 4]));
  git('add', '--all');
  git('update-index', '--add', '--cacheinfo', `160000,${base},vendor/submodule`);
  git('update-index', '--add', '--cacheinfo', `160000,${'b'.repeat(40)},vendor/existing`);
  git('update-index', '--add', '--cacheinfo', `160000,${'d'.repeat(40)},converted.txt`);
  git('update-index', '--force-remove', 'vendor/removed');
  git('commit', '-qm', 'head');
  const head = git('rev-parse', 'HEAD');
  const sha = (commit, path) => git('rev-parse', `${commit}:${path}`);
  const files = [
    { filename: unusual, status: 'modified', sha: sha(head, unusual) },
    { filename: 'new name.txt', previous_filename: 'old name.txt', status: 'renamed', sha: sha(head, 'new name.txt') },
    { filename: 'same-new.txt', previous_filename: 'same-old.txt', status: 'renamed', sha: sha(head, 'same-new.txt') },
    { filename: 'mode.txt', status: 'modified', sha: sha(head, 'mode.txt') },
    { filename: 'mode-content.txt', status: 'modified', sha: sha(head, 'mode-content.txt') },
    { filename: 'long.txt', status: 'modified', sha: sha(head, 'long.txt') },
    { filename: 'removed.txt', status: 'removed', sha: sha(base, 'removed.txt') },
    { filename: 'added.txt', status: 'added', sha: sha(head, 'added.txt') },
    { filename: 'empty-removed.txt', status: 'removed', sha: sha(base, 'empty-removed.txt') },
    { filename: 'empty-added.txt', status: 'added', sha: sha(head, 'empty-added.txt') },
    { filename: 'binary.bin', status: 'modified', sha: sha(head, 'binary.bin') },
    { filename: 'vendor/submodule', status: 'added', sha: base },
    { filename: 'vendor/existing', status: 'modified', sha: 'b'.repeat(40) },
    { filename: 'vendor/removed', status: 'removed', sha: 'c'.repeat(40) },
    { filename: 'converted.txt', status: 'changed', sha: 'd'.repeat(40) },
    { filename: 'missing.txt', status: 'modified', sha: sha(head, 'added.txt') },
    { filename: 'added.txt', status: 'added', sha: 'a'.repeat(40) },
  ];
  // Inherited diff, textconv, smudge and checkout hooks must never run.
  const marker = join(cache, 'executed');
  const trap = join(cache, 'trap.sh');
  writeFileSync(trap, `#!/bin/sh\nprintf executed > '${marker}'\n`);
  chmodSync(trap, 0o755);
  writeFileSync(join(repo, '.git/hooks/post-checkout'), `#!/bin/sh\n'${trap}'\n`);
  chmodSync(join(repo, '.git/hooks/post-checkout'), 0o755);
  writeFileSync(join(repo, '.gitattributes'), '* diff=trap filter=trap\n');
  git('config', 'diff.external', '/bin/false');
  git('config', 'diff.trap.textconv', trap);
  git('config', 'filter.trap.smudge', trap);
  const modes = fileModes({ files, mergeBase: base, head, cache });
  assert.equal(modes.files.length, 14);
  assert.deepEqual(modes.skipped.map((item) => item.filename), ['converted.txt', 'missing.txt', 'added.txt']);
  assert.match(modes.skipped[0].reason, /type conversion/);
  const byName = (name) => modes.files.find((f) => f.filename === name);
  assert.deepEqual([byName('mode-content.txt').oldMode, byName('mode-content.txt').newMode], ['100644', '100755']);
  assert.deepEqual([byName('long.txt').oldMode, byName('long.txt').newMode], ['100644', '100644']);
  assert.deepEqual([byName('new name.txt').oldMode, byName('new name.txt').newMode], ['100644', '100644']);
  assert.deepEqual([byName('added.txt').oldMode, byName('added.txt').newMode], [null, '100644']);
  assert.deepEqual([byName('removed.txt').oldMode, byName('removed.txt').newMode], ['100644', null]);
  assert.deepEqual([byName('vendor/submodule').oldMode, byName('vendor/submodule').newMode], [null, '160000']);
  assert.deepEqual([byName('vendor/existing').oldMode, byName('vendor/existing').newMode], ['160000', '160000']);
  assert.deepEqual([byName('vendor/existing').oldOid, byName('vendor/existing').newOid], ['a'.repeat(40), 'b'.repeat(40)]);
  assert.deepEqual([byName('vendor/submodule').oldOid, byName('vendor/submodule').newOid], [null, base]);
  assert.deepEqual([byName('vendor/removed').oldOid, byName('vendor/removed').newOid], ['c'.repeat(40), null]);
  const result = recoverPatches({ files, mergeBase: base, head, cache });
  assert.equal(result.files.length, 13);
  assert.deepEqual(result.skipped.map((item) => item.filename), ['binary.bin', 'converted.txt', 'missing.txt', 'added.txt']);
  assert.match(result.skipped[0].reason, /binary/i);
  assert.match(result.skipped[1].reason, /type conversion/);
  assert.match(result.skipped[3].reason, /does not match/);
  assert.match(result.files.find((f) => f.filename === unusual).patch, /-before\n\+after/);
  assert.match(result.files.find((f) => f.filename === 'new name.txt').patch, /-rename old\n\+rename new/);
  assert.match(result.files.find((f) => f.filename === 'same-new.txt').patch, /metadata-only.*same-old\.txt.*same-new\.txt/);
  assert.match(result.files.find((f) => f.filename === 'mode.txt').patch, /metadata-only.*100644.*100755/);
  assert.match(result.files.find((f) => f.filename === 'empty-added.txt').patch, /metadata-only.*"oldPath":null/);
  assert.match(result.files.find((f) => f.filename === 'empty-removed.txt').patch, /metadata-only.*"newPath":null/);
  assert.equal(result.files.find((f) => f.filename === 'vendor/submodule').patch, `@@ -0,0 +1 @@\n+Subproject commit ${base}`);
  assert.equal(result.files.find((f) => f.filename === 'vendor/existing').patch, `@@ -1 +1 @@\n-Subproject commit ${'a'.repeat(40)}\n+Subproject commit ${'b'.repeat(40)}`);
  assert.equal(result.files.find((f) => f.filename === 'vendor/removed').patch, `@@ -1 +0,0 @@\n-Subproject commit ${'c'.repeat(40)}`);
  assert.ok(result.files.find((f) => f.filename === 'long.txt').patch.includes(`+${long}`));
  assert.equal(planReview(result.files).selected.length, 13);
  assert.equal(existsSync(marker), false);
  assert.equal(readFileSync(join(repo, unusual), 'utf8'), 'after\n');
  assert.throws(() => recoverPatches({ files, mergeBase: base, head: 'a'.repeat(40), cache }), /Command failed/);
  assert.throws(() => recoverPatches({ files, mergeBase: 'not-a-sha', head, cache }), /Invalid Git object ID/);

  // A repository-wide Git read failure is retried, not recorded as a permanent file omission.
  const realGit = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
  const bin = join(cache, 'fault-bin');
  mkdirSync(bin);
  const wrapper = join(bin, 'git');
  const oldPath = process.env.PATH;
  process.env.PATH = `${bin}:${oldPath}`;
  try {
    for (const failure of ["printf '%s\\n' 'fatal: Input/output error' >&2; exit 128", 'kill -s TERM $$']) {
      writeFileSync(wrapper, `#!/bin/sh\nfor arg in "$@"; do\n  if [ "$arg" = 'mode.txt' ]; then ${failure}; fi\ndone\nexec '${realGit.replaceAll("'", "'\\''")}' "$@"\n`);
      chmodSync(wrapper, 0o755);
      assert.throws(() => recoverPatches({ files: [files.find((file) => file.filename === 'mode.txt')], mergeBase: base, head, cache }), /Temporary Git failure; retry planned/);
    }
  } finally {
    process.env.PATH = oldPath;
  }
});
