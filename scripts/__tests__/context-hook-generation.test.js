const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../..');
const hook = (file) => fs.readFileSync(path.join(ROOT, 'plugins/aidd-context/skills/08-hook-generate', file), 'utf8');
const fixture = (file) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/context-generation/hooks/mixed', file), 'utf8'));

test('Kilo hooks end with supported guidance and no generated artifacts', () => {
  const paths = hook('references/tool-paths.md');
  const capture = hook('actions/01-capture-hook.md');
  const write = hook('actions/02-write-hook.md');
  assert.match(paths, /\*\*Kilo guidance\.\*\*[\s\S]*`\.kilo\/plugin\/` and `\.kilo\/plugins\/`/u);
  assert.match(paths, /Kilo-supported paths, not AIDD output destinations/u);
  assert.match(paths, /AIDD does not generate a Kilo plugin or hook/u);
  assert.match(paths, /https:\/\/kilo\.ai\/docs\/automate\/extending\/plugins/u);
  assert.match(paths, /session\.created/u);
  assert.match(paths, /unsupported.*no.*fallback/iu);
  assert.match(capture, /Kilo.*terminal.*guidance/iu);
  assert.match(write, /Kilo.*no.*write/iu);
});

test('mixed targets preflight before any script or config and preserve user hooks', () => {
  const write = hook('actions/02-write-hook.md');
  const validate = hook('actions/03-validate.md');
  assert.ok(write.indexOf('**Preflight.**') < write.indexOf('**Script.**'));
  const preflight = write.match(/2\. \*\*Preflight\.\*\*([\s\S]*?)(?=\n3\. \*\*Script\.\*\*)/u)?.[1] ?? '';
  assert.match(write, /exact AIDD entry/u);
  assert.match(write, /preserve.*user.*duplicate/iu);
  assert.match(preflight, /If any target is invalid, abort before any write/u);
  assert.match(validate, /second pass.*byte.identical/iu);
});

test('mixed hook contract fixtures retain user duplicates and one AIDD entry per target', () => {
  const configs = [
    ['.claude/settings.json', 'SessionStart', (entry) => entry.hooks[0].command],
    ['.codex/hooks.json', 'SessionStart', (entry) => entry.hooks[0].command],
    ['.cursor/hooks.json', 'sessionStart', (entry) => entry.command],
    ['.github/hooks/aidd.json', 'SessionStart', (entry) => entry.command],
  ];
  for (const [file, event, command] of configs) {
    const config = fixture(file);
    const entries = config.hooks[event].map(command);
    assert.deepEqual(entries, ['/project/hooks/user.sh', '/project/hooks/user.sh', '/project/hooks/aidd.sh'], file);
  }
  assert.deepEqual(fixture('kilo.json'), {});
  assert.equal(fs.existsSync(path.join(__dirname, 'fixtures/context-generation/hooks/mixed/.kilo/hooks.json')), false);
  const userBody = fs.readFileSync(path.join(__dirname, 'fixtures/context-generation/hooks/mixed/hooks/user.sh'), 'utf8');
  assert.match(userBody, /USER_HOOK_BODY_UNCHANGED/u);
});

test('invalid final mixed target is detectable before creating any earlier target', () => {
  const base = path.join(__dirname, 'fixtures/context-generation/hooks/invalid');
  const copilot = JSON.parse(fs.readFileSync(path.join(base, '.github/hooks/aidd.json'), 'utf8'));
  assert.equal(typeof copilot.hooks.SessionStart, 'string');
  assert.equal(fs.existsSync(path.join(base, '.claude/settings.json')), false);
  assert.equal(fs.existsSync(path.join(base, 'hooks/aidd.sh')), false);
  assert.equal(fs.existsSync(path.join(base, '.kilo/hooks.json')), false);
});
