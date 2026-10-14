const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { sync } = require('../sync-codex-agents.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-agent-sync-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dirs = ['built', 'installed', 'snapshot/2.6.0/codex-agents'].map(name => path.join(root, name));
  dirs.forEach(dir => fs.mkdirSync(dir, { recursive: true }));
  const [built, installed, old] = dirs;
  const put = (dir, name, text) => fs.writeFileSync(path.join(dir, name), text);
  const run = () => sync('aidd-dev', built, installed, path.join(root, 'snapshot'));
  return { built, installed, old, put, run };
}
const agent = name => `name = "${name}"\ndescription = "Task"\n`;
test('namespace roles and preserve personal and modified short agents', t => {
  const f = fixture(t);
  f.put(f.built, 'reviewer.toml', agent('reviewer'));
  f.put(f.old, 'checker.toml', agent('checker'));
  f.put(f.old, 'executor.toml', agent('executor'));
  f.put(f.installed, 'checker.toml', agent('checker'));
  f.put(f.installed, 'executor.toml', agent('executor') + '# personal modification\n');
  f.put(f.installed, 'reviewer.toml', '# personal reviewer\n');
  f.put(f.installed, 'aidd-dev-checker.toml', agent('aidd-dev-checker'));
  f.put(f.installed, 'other-checker.toml', agent('other-checker'));
  f.run();
  assert.deepEqual(fs.readdirSync(f.installed).sort(), ['aidd-dev-reviewer.toml', 'executor.toml', 'other-checker.toml', 'reviewer.toml']);
  assert.equal(fs.readFileSync(path.join(f.installed, 'reviewer.toml'), 'utf8'), '# personal reviewer\n');
  assert.equal(fs.readFileSync(path.join(f.installed, 'aidd-dev-reviewer.toml'), 'utf8'), agent('aidd-dev-reviewer'));
  const once = fs.readdirSync(f.installed).map(name => [name, fs.readFileSync(path.join(f.installed, name), 'utf8')]);
  f.run();
  assert.deepEqual(fs.readdirSync(f.installed).map(name => [name, fs.readFileSync(path.join(f.installed, name), 'utf8')]), once);
});
test('malformed build leaves every installed agent unchanged', t => {
  const f = fixture(t);
  f.put(f.built, 'good.toml', agent('good'));
  f.put(f.built, 'invalid.toml', 'description = "Missing name"\n');
  f.put(f.old, 'checker.toml', agent('checker'));
  f.put(f.installed, 'checker.toml', agent('checker'));
  f.put(f.installed, 'aidd-dev-stale.toml', agent('aidd-dev-stale'));
  assert.throws(f.run, /Invalid generated agent/);
  assert.deepEqual(fs.readdirSync(f.installed).sort(), ['aidd-dev-stale.toml', 'checker.toml']);
  assert.equal(fs.readFileSync(path.join(f.installed, 'checker.toml'), 'utf8'), agent('checker'));
});
