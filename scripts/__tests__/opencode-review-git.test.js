const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chmodSync, existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { diffFiles } = require('../opencode-review/git.mjs');

test('uses Git patches for each file, including metadata, without executing PR content', (t) => {
  const temp = join(process.cwd(), '.tmp');
  mkdirSync(temp, { recursive: true });
  const cache = mkdtempSync(join(temp, 'opencode-review-git-'));
  t.after(() => process.platform === 'darwin' ? execFileSync('trash', [cache]) : rmSync(cache, { recursive: true, force: true }));
  const repo = join(cache, 'git');
  mkdirSync(repo);
  // Git hooks can export GIT_DIR and GIT_WORK_TREE: never let a fixture edit that repository.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  Object.assign(env, { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' });
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', env }).trim();
  git('init', '-q');
  git('config', 'user.name', 'Review fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  const unusual = ':(literal)*[name].txt';
  const long = 'é'.repeat(4000);
  writeFileSync(join(repo, unusual), 'before\n');
  writeFileSync(join(repo, 'old name.txt'), 'same text\n');
  writeFileSync(join(repo, 'mode.txt'), 'same content\n');
  writeFileSync(join(repo, 'long.txt'), 'old line\n');
  writeFileSync(join(repo, 'removed.txt'), 'gone\n');
  writeFileSync(join(repo, 'binary.bin'), Buffer.from([0, 1, 2]));
  git('add', '--all');
  git('update-index', '--add', '--cacheinfo', `160000,${'a'.repeat(40)},vendor/submodule`);
  git('commit', '-qm', 'base');
  const base = git('rev-parse', 'HEAD');
  writeFileSync(join(repo, unusual), 'after\n');
  git('mv', 'old name.txt', 'new name.txt');
  chmodSync(join(repo, 'mode.txt'), 0o755);
  writeFileSync(join(repo, 'long.txt'), `${long}\n`);
  git('rm', '-q', 'removed.txt');
  writeFileSync(join(repo, 'added.txt'), 'added\n');
  writeFileSync(join(repo, 'empty.txt'), '');
  writeFileSync(join(repo, 'invalid.txt'), Buffer.from([0xff, 0xfe]));
  writeFileSync(join(repo, 'oversized.txt'), `${'x'.repeat(121000)}\n`);
  writeFileSync(join(repo, 'binary.bin'), Buffer.from([0, 3, 4]));
  git('add', '--all');
  git('update-index', '--add', '--cacheinfo', `160000,${'b'.repeat(40)},vendor/submodule`);
  git('commit', '-qm', 'head');
  const head = git('rev-parse', 'HEAD');
  const sha = (commit, path) => git('rev-parse', `${commit}:${path}`);
  const files = [
    { filename: unusual, status: 'modified', sha: sha(head, unusual) },
    { filename: 'new name.txt', previous_filename: 'old name.txt', status: 'renamed', sha: sha(head, 'new name.txt') },
    { filename: 'mode.txt', status: 'modified', sha: sha(head, 'mode.txt') },
    { filename: 'long.txt', status: 'modified', sha: sha(head, 'long.txt') },
    { filename: 'removed.txt', status: 'removed', sha: sha(base, 'removed.txt') },
    { filename: 'added.txt', status: 'added', sha: sha(head, 'added.txt') },
    { filename: 'empty.txt', status: 'added', sha: sha(head, 'empty.txt') },
    { filename: 'vendor/submodule', status: 'modified', sha: 'b'.repeat(40) },
    { filename: 'binary.bin', status: 'modified', sha: sha(head, 'binary.bin') },
    { filename: 'invalid.txt', status: 'added', sha: sha(head, 'invalid.txt') },
    { filename: 'oversized.txt', status: 'added', sha: sha(head, 'oversized.txt') },
  ];
  const marker = join(cache, 'executed');
  const trap = join(cache, 'trap.sh');
  writeFileSync(trap, `#!/bin/sh\nprintf executed > '${marker}'\n`);
  chmodSync(trap, 0o755);
  writeFileSync(join(repo, '.gitattributes'), '* diff=trap filter=trap\n');
  git('config', 'diff.external', '/bin/false');
  git('config', 'diff.trap.textconv', trap);
  git('config', 'filter.trap.smudge', trap);

  const result = diffFiles({ files, mergeBase: base, head, cache });
  assert.equal(result.files.length, 8);
  assert.deepEqual(result.skipped.map((item) => item.filename), ['binary.bin', 'invalid.txt', 'oversized.txt']);
  assert.match(result.skipped[0].reason, /binary/i);
  assert.match(result.skipped[1].reason, /UTF-8/);
  assert.match(result.skipped[2].reason, /120000/);
  const byName = (name) => result.files.find((item) => item.filename === name);
  assert.match(byName(unusual).patch, /-before\n\+after/);
  assert.match(byName('new name.txt').patch, /rename from old name.txt\nrename to new name.txt/);
  assert.match(byName('mode.txt').patch, /old mode 100644\nnew mode 100755/);
  assert.ok(byName('long.txt').patch.includes(`+${long}`));
  assert.match(byName('removed.txt').patch, /deleted file mode 100644/);
  assert.match(byName('added.txt').patch, /new file mode 100644/);
  assert.match(byName('empty.txt').patch, /new file mode 100644/);
  assert.match(byName('vendor/submodule').patch, /Subproject commit/);
  assert.equal(existsSync(marker), false);
  const repeat = diffFiles({ files: [files[0]], mergeBase: base, head, cache });
  assert.equal(repeat.files[0].fingerprint, byName(unusual).fingerprint);
  assert.match(repeat.files[0].fingerprint, /^[0-9a-f]{64}$/);
  assert.throws(() => diffFiles({ files: [{ ...files[0], sha: 'f'.repeat(40) }], mergeBase: base, head, cache }), /does not match/);
  assert.throws(() => diffFiles({ files, mergeBase: 'not-a-sha', head, cache }), /Invalid Git object ID/);

  // A Git read failure aborts rather than marking a file reviewed or permanently skipped.
  const realGit = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
  const bin = join(cache, 'fault-bin');
  mkdirSync(bin);
  const wrapper = join(bin, 'git');
  writeFileSync(wrapper, `#!/bin/sh\nfor arg in "$@"; do\n  if [ "$arg" = 'mode.txt' ]; then echo 'fatal: Input/output error' >&2; exit 128; fi\ndone\nexec '${realGit.replaceAll("'", "'\\''")}' "$@"\n`);
  chmodSync(wrapper, 0o755);
  const oldPath = process.env.PATH;
  process.env.PATH = `${bin}:${oldPath}`;
  try {
    assert.throws(() => diffFiles({ files: [files[2]], mergeBase: base, head, cache }), /Command failed/);
  } finally {
    process.env.PATH = oldPath;
  }
});
