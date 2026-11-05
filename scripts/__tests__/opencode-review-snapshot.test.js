const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { existsSync, lstatSync, mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const script = resolve('scripts/opencode-review/snapshot.py');

function fixture(t, variant) {
  const dir = mkdtempSync(join(tmpdir(), 'aidd-review-snapshot-'));
  t.after(() => process.platform === 'darwin' ? execFileSync('trash', [dir]) : rmSync(dir, { recursive: true, force: true }));
  const archive = join(dir, 'source.tar.gz');
  const generator = String.raw`
import io, sys, tarfile
archive, variant = sys.argv[1:]
with tarfile.open(archive, 'w:gz') as tar:
 def file(name, data):
  info = tarfile.TarInfo(name); info.size = len(data); tar.addfile(info, io.BytesIO(data))
 file('root/src/safe.js', b'safe content\n')
 if variant == 'normal':
  for name in ['root/.opencode/config.json', 'root/.agents/tool', 'root/nested/.claude/tool',
               'root/.review-input/file', 'root/nested/AGENTS.md', 'root/CLAUDE.md',
               'root/opencode.json', 'root/nested/opencode.jsonc', 'root/.env.secret',
               'root/.aidd-context-incomplete']:
   file(name, b'untrusted configuration')
 elif variant == 'hostile':
  file('root/../escape', b'escape')
  file('/absolute/escape', b'escape')
  info = tarfile.TarInfo('root/link'); info.type = tarfile.SYMTYPE; info.linkname = '../../escape'; tar.addfile(info)
  file('root/link/child', b'inside snapshot')
  info = tarfile.TarInfo('root/hardlink'); info.type = tarfile.LNKTYPE; info.linkname = 'root/src/safe.js'; tar.addfile(info)
  file('other-root/file', b'escape')
 elif variant == 'limit':
  file('root/large.txt', b'x' * 100_000)
`;
  execFileSync('python3', ['-c', generator, archive, variant]);
  return { dir, archive, out: join(dir, 'snapshot') };
}

test('extracts normal files while excluding PR instructions, configuration and fake sentinel', (t) => {
  const f = fixture(t, 'normal');
  const out = execFileSync('python3', [script, f.archive, f.out], { encoding: 'utf8' });
  assert.match(out, /snapshot: complete/);
  assert.equal(readFileSync(join(f.out, 'src/safe.js'), 'utf8'), 'safe content\n');
  for (const path of ['.opencode', '.agents', 'nested/.claude', '.review-input', 'nested/AGENTS.md', 'CLAUDE.md', 'opencode.json', 'nested/opencode.jsonc', '.env.secret', '.aidd-context-incomplete']) {
    assert.equal(existsSync(join(f.out, path)), false, path);
  }
});

test('refuses traversal, absolute paths, links and other archive roots', (t) => {
  const f = fixture(t, 'hostile');
  const out = execFileSync('python3', [script, f.archive, f.out], { encoding: 'utf8' });
  assert.match(out, /snapshot: incomplete/);
  assert.equal(readFileSync(join(f.out, 'src/safe.js'), 'utf8'), 'safe content\n');
  assert.equal(existsSync(join(f.dir, 'escape')), false);
  assert.equal(lstatSync(join(f.out, 'link')).isDirectory(), true);
  assert.equal(readFileSync(join(f.out, 'link/child'), 'utf8'), 'inside snapshot');
  assert.equal(existsSync(join(f.out, 'hardlink')), false);
  assert.equal(existsSync(join(f.out, 'file')), false);
  assert.equal(lstatSync(join(f.out, '.aidd-context-incomplete')).isFile(), true);
});

test('stops at file, byte and decompressed-stream limits without writing an oversized file', (t) => {
  const f = fixture(t, 'limit');
  const code = String.raw`
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location('snapshot', sys.argv[1]); module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
result = module.extract(sys.argv[2], sys.argv[3], max_bytes=int(sys.argv[4]), max_files=int(sys.argv[5]), max_archive_bytes=int(sys.argv[6]))
print(json.dumps(result))
`;
  for (const [name, maxBytes, maxFiles, maxArchive] of [['bytes', 32, 100, 1_000_000], ['files', 1_000_000, 1, 1_000_000], ['stream', 1_000_000, 100, 2048]]) {
    const dest = join(f.dir, name);
    const result = JSON.parse(execFileSync('python3', ['-B', '-c', code, script, f.archive, dest, String(maxBytes), String(maxFiles), String(maxArchive)], { encoding: 'utf8' }));
    assert.equal(result.complete, false, name);
    assert.equal(existsSync(join(dest, '.aidd-context-incomplete')), true, name);
    assert.equal(existsSync(join(dest, 'large.txt')), false, name);
    assert.ok(result.bytes <= maxBytes, name);
    assert.ok(result.files <= maxFiles, name);
  }
});
