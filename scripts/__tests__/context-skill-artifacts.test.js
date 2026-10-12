const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '../..');
const SKILL = 'plugins/aidd-context/skills/04-skill-generate';
const read = (file) => fs.readFileSync(path.join(ROOT, SKILL, file), 'utf8');
const normalizeEol = (text) => text.replace(/\r\n/gu, '\n');

// These checks validate documented contracts; they do not execute a skill writer.
test('static contract: skill detection lists the six Kilo signals and keeps OpenCode distinct', () => {
  const detection = read('references/tool-detect.md');
  const row = detection.split('\n').find((line) => /^\| Kilo\s*\|/u.test(line));
  assert.ok(row, 'Missing Kilo detection row');
  assert.deepEqual([...row.matchAll(/`([^`]+)`/gu)].map((m) => m[1]),
    ['.kilo/', 'kilo.json', 'kilo.jsonc', '.kilo/kilo.json', '.kilo/kilo.jsonc', '.kilocode/']);
  assert.match(detection, /\| OpenCode\s*\| `\.opencode\/`/u);
  assert.match(detection, /(?:AGENTS\.md|opencode\.json)[^\n]*not[^\n]*Kilo/u);
});

test('static contract: Kilo placement requires portable consent and resolves duplicates before writing', () => {
  const placement = read('references/tool-write.md');
  assert.match(placement, /\.kilo\/skills\/<name>\//u);
  assert.match(placement, /explicit[^\n]*\.agents\/skills/iu);
  assert.match(placement, /never[^\n]*both/iu);
  assert.match(placement, /copies[^\n]*resolution[^\n]*before[^\n]*writ/iu);
  assert.match(read('actions/01-scope.md'), /tool-write\.md/u);
  assert.match(read('references/scope-frame.md'), /placement/u);
});

test('static contract: Kilo fields stay target-specific without weakening the Claude template', () => {
  const placement = read('references/tool-write.md');
  assert.match(placement, /\| Kilo[^\n]*`name`[^\n]*`description`/u);
  assert.match(placement, /name[^\n]*parent directory/u);
  assert.match(placement, /argument-hint[^\n]*Kilo/u);
  assert.match(read('assets/skill-template.md'), /argument-hint:/u);
  assert.match(read('references/skill-authoring.md'), /\*\*R4\.\*\*/u);
});

test('static contract: full preflight precedes creation and covers unsafe paths and user resources', () => {
  const write = read('actions/03-write.md');
  const preflight = write.indexOf('**Preflight.**');
  const tree = write.indexOf('**Tree.**');
  assert.ok(preflight >= 0 && tree > preflight, 'Preflight must exist before Tree');
  const placement = read('references/tool-write.md');
  for (const invariant of ['symlink', 'writable', 'references', 'collision', 'unchanged', 'mtime']) {
    assert.ok(placement.includes(invariant), `Missing ${invariant}`);
  }
  assert.match(read('actions/04-validate.md'), /tool-write\.md/u);
});

const FIXTURES = path.join(__dirname, 'fixtures/context-generation/skills');
// Golden artifacts are produced by the native caller using the candidate skill,
// not by a test-only renderer. Absent evidence is a failure, never a skipped pass.
test('fixture contract: generated target trees have valid frontmatter, links and preserved resources', () => {
  const cases = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'cases.json'), 'utf8'));
  for (const fixture of cases) {
    const dir = path.join(FIXTURES, fixture.project, fixture.target, 'verify-payload');
    const text = normalizeEol(fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8'));
    const match = text.match(/^---\n([\s\S]*?)\n---\n/u);
    assert.ok(match, fixture.project);
    const fields = yaml.load(match[1]);
    assert.deepEqual(Object.keys(fields).sort(), fixture.fields.sort());
    assert.equal(fields.description, 'Verify a bundled payload. Use when the user wants to verify the phase three fixture.');
    if (fixture.fields.includes('name')) assert.equal(fields.name, path.basename(dir));
    assert.match(text, /flowchart/u);
    assert.match(text, /\| Action\s*\| Does/u);
    for (const link of text.matchAll(/\]\(([^)]+)\)/gu)) {
      const resolved = path.resolve(dir, link[1]);
      assert.ok(resolved.startsWith(`${dir}${path.sep}`));
      assert.ok(fs.existsSync(resolved), link[1]);
    }
    assert.ok(fs.readFileSync(path.join(dir, 'actions/01-verify.md'), 'utf8').includes('assets/payload.txt'));
    assert.equal(normalizeEol(fs.readFileSync(path.join(dir, 'assets/user.txt'), 'utf8')), 'USER_RESOURCE_DO_NOT_REPLACE\n');
    for (const absent of fixture.absent) assert.ok(!fs.existsSync(path.join(FIXTURES, fixture.project, absent)), absent);
  }
});

const detectionFixtures = path.join(__dirname, 'fixtures/context-generation/detection');
for (const fixture of JSON.parse(fs.readFileSync(path.join(detectionFixtures, 'cases.json'), 'utf8'))) {
  test(`static contract: Kilo detection oracle recognizes ${fixture.name}`, () => {
    const row = read('references/tool-detect.md').split('\n').find((line) => /^\| Kilo\s*\|/u.test(line));
    assert.ok(row);
    const signals = [...row.matchAll(/`([^`]+)`/gu)].map((m) => m[1]);
    const project = path.join(detectionFixtures, fixture.project);
    assert.equal(signals.some((signal) => {
      const p = path.join(project, signal);
      return fs.existsSync(p) && (signal.endsWith('/') ? fs.statSync(p).isDirectory() : fs.statSync(p).isFile());
    }), fixture.kilo);
  });
}

test('fixture contract: native and portable trees each preserve the user resource once', () => {
  for (const project of ['native', 'portable']) {
    const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'cases.json'), 'utf8'))
      .find((item) => item.project === project);
    assert.ok(fixture);
    const dir = path.join(FIXTURES, project, fixture.target, 'verify-payload');
    assert.equal(fs.readFileSync(path.join(dir, 'assets/user.txt'), 'utf8'), 'USER_RESOURCE_DO_NOT_REPLACE\n');
    assert.ok(fs.existsSync(path.join(dir, 'actions/01-verify.md')));
    assert.ok(fs.existsSync(path.join(dir, 'assets/payload.txt')));
  }
});

test('static contract: shared portable fields require resolution when Kilo fields conflict with Codex', () => {
  const contract = read('references/tool-write.md');
  assert.match(contract, /share a destination[^\n]*common supported fields/u);
  assert.match(contract, /requested field[^\n]*incompatible[^\n]*resolution before writing/u);
  assert.match(contract, /never silently drop a requested field/u);
});

test('static contract: mixed Kilo-native and portable targets resolve placement before writing', () => {
  const contract = read('references/tool-write.md');
  assert.match(contract, /Kilo native[^\n]*another selected host[^\n]*resolution before writing/u);
  assert.match(contract, /never create both trees/u);
});
