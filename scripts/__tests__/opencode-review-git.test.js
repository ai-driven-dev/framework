const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { recoverPatches } = require('../opencode-review/git.mjs');
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
  writeFileSync(join(repo, 'long.txt'), 'old line\n');
  writeFileSync(join(repo, 'removed.txt'), 'gone\n');
  writeFileSync(join(repo, 'empty-removed.txt'), '');
  writeFileSync(join(repo, 'binary.bin'), Buffer.from([0, 1, 2]));
  git('add', '--all'); git('commit', '-qm', 'base');
  const base = git('rev-parse', 'HEAD');
  writeFileSync(join(repo, unusual), 'after\n');
  git('mv', 'old name.txt', 'new name.txt');
  git('mv', 'same-old.txt', 'same-new.txt');
  chmodSync(join(repo, 'mode.txt'), 0o755);
  writeFileSync(join(repo, 'new name.txt'), 'rename new\n');
  writeFileSync(join(repo, 'long.txt'), `${long}\n`);
  git('rm', '-q', 'removed.txt');
  git('rm', '-q', 'empty-removed.txt');
  writeFileSync(join(repo, 'added.txt'), 'added\n');
  writeFileSync(join(repo, 'empty-added.txt'), '');
  writeFileSync(join(repo, 'binary.bin'), Buffer.from([0, 3, 4]));
  git('add', '--all'); git('commit', '-qm', 'head');
  const head = git('rev-parse', 'HEAD');
  const sha = (commit, path) => git('rev-parse', `${commit}:${path}`);
  const files = [
    { filename: unusual, status: 'modified', sha: sha(head, unusual) },
    { filename: 'new name.txt', previous_filename: 'old name.txt', status: 'renamed', sha: sha(head, 'new name.txt') },
    { filename: 'same-new.txt', previous_filename: 'same-old.txt', status: 'renamed', sha: sha(head, 'same-new.txt') },
    { filename: 'mode.txt', status: 'modified', sha: sha(head, 'mode.txt') },
    { filename: 'long.txt', status: 'modified', sha: sha(head, 'long.txt') },
    { filename: 'removed.txt', status: 'removed', sha: sha(base, 'removed.txt') },
    { filename: 'added.txt', status: 'added', sha: sha(head, 'added.txt') },
    { filename: 'empty-removed.txt', status: 'removed', sha: sha(base, 'empty-removed.txt') },
    { filename: 'empty-added.txt', status: 'added', sha: sha(head, 'empty-added.txt') },
    { filename: 'binary.bin', status: 'modified', sha: sha(head, 'binary.bin') },
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
  const result = recoverPatches({ files, mergeBase: base, head, cache });
  assert.equal(result.files.length, 9);
  assert.deepEqual(result.skipped.map((item) => item.filename), ['binary.bin', 'missing.txt', 'added.txt']);
  assert.match(result.skipped[0].reason, /binary/i);
  assert.match(result.skipped[2].reason, /does not match/);
  assert.match(result.files.find((f) => f.filename === unusual).patch, /-before\n\+after/);
  assert.match(result.files.find((f) => f.filename === 'new name.txt').patch, /-rename old\n\+rename new/);
  assert.match(result.files.find((f) => f.filename === 'same-new.txt').patch, /metadata-only.*same-old\.txt.*same-new\.txt/);
  assert.match(result.files.find((f) => f.filename === 'mode.txt').patch, /metadata-only.*100644.*100755/);
  assert.match(result.files.find((f) => f.filename === 'empty-added.txt').patch, /metadata-only.*"oldPath":null/);
  assert.match(result.files.find((f) => f.filename === 'empty-removed.txt').patch, /metadata-only.*"newPath":null/);
  assert.ok(result.files.find((f) => f.filename === 'long.txt').patch.includes(`+${long}`));
  assert.equal(planReview(result.files).selected.length, 9);
  assert.equal(existsSync(marker), false);
  assert.equal(readFileSync(join(repo, unusual), 'utf8'), 'after\n');
  assert.throws(() => recoverPatches({ files, mergeBase: base, head: 'a'.repeat(40), cache }), /Command failed/);
  assert.throws(() => recoverPatches({ files, mergeBase: 'not-a-sha', head, cache }), /Invalid Git object ID/);
});
