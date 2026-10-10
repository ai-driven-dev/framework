const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '../..');
const SKILL = 'plugins/aidd-context/skills/04-skill-generate';
const read = (file) => fs.readFileSync(path.join(ROOT, SKILL, file), 'utf8');

// Markdown is the shipped implementation. These guards do not simulate an LLM
// writer. Behavioral receipts and real generated trees are checked separately.
test('skill detection lists exactly the six Kilo signals and keeps OpenCode distinct', () => {
  const detection = read('references/tool-detect.md');
  const row = detection.split('\n').find((line) => /^\| Kilo\s*\|/u.test(line));
  assert.ok(row, 'Missing Kilo detection row');
  assert.deepEqual([...row.matchAll(/`([^`]+)`/gu)].map((m) => m[1]),
    ['.kilo/', 'kilo.json', 'kilo.jsonc', '.kilo/kilo.json', '.kilo/kilo.jsonc', '.kilocode/']);
  assert.match(detection, /\| OpenCode\s*\| `\.opencode\/`/u);
  assert.match(detection, /(?:AGENTS\.md|opencode\.json)[^\n]*not[^\n]*Kilo/u);
});

test('Kilo placement requires explicit portable consent and resolves duplicates before writing', () => {
  const placement = read('references/tool-write.md');
  assert.match(placement, /\.kilo\/skills\/<name>\//u);
  assert.match(placement, /explicit[^\n]*\.agents\/skills/iu);
  assert.match(placement, /never[^\n]*both/iu);
  assert.match(placement, /copies[^\n]*resolution[^\n]*before[^\n]*writ/iu);
  assert.match(read('actions/01-scope.md'), /tool-write\.md/u);
  assert.match(read('references/scope-frame.md'), /placement/u);
});

test('Kilo fields are target-specific without weakening the Claude authoring template', () => {
  const placement = read('references/tool-write.md');
  assert.match(placement, /\| Kilo[^\n]*`name`[^\n]*`description`/u);
  assert.match(placement, /name[^\n]*parent directory/u);
  assert.match(placement, /argument-hint[^\n]*Kilo/u);
  assert.match(read('assets/skill-template.md'), /argument-hint:/u);
  assert.match(read('references/skill-authoring.md'), /\*\*R4\.\*\*/u);
});

test('full preflight precedes creation and covers unsafe paths and user resources', () => {
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

test('Kilo path claims carry official source and attributed historical date', () => {
  for (const file of ['references/tool-detect.md', 'references/tool-write.md']) {
    const source = read(file);
    assert.ok(source.includes('https://kilo.ai/docs/'));
    assert.match(source, /2026-09-25[^\n]*issue/u);
    assert.match(source, /2026-10-10/u);
  }
});

const FIXTURES = path.join(__dirname, 'fixtures/context-generation/skills');
// Golden artifacts are produced by the native caller using the candidate skill,
// not by a test-only renderer. Absent evidence is a failure, never a skipped pass.
test('caller-generated target trees have valid frontmatter, router links and preserved resources', () => {
  const cases = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'cases.json'), 'utf8'));
  for (const fixture of cases) {
    const dir = path.join(FIXTURES, fixture.project, fixture.target, 'verify-payload');
    const text = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
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
    assert.equal(fs.readFileSync(path.join(dir, 'assets/user.txt'), 'utf8'), 'USER_RESOURCE_DO_NOT_REPLACE\n');
    for (const absent of fixture.absent) assert.ok(!fs.existsSync(path.join(FIXTURES, fixture.project, absent)), absent);
  }
});

const EVIDENCE = path.join(ROOT, 'aidd_docs/tasks/2026_10/2026_10_10_kilo-native-generation-914/evidence/phase-3');
test('caller modify preserves user files and identical rerun preserves whole tree bytes and mtime', () => {
  const proof = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'caller-modify-rerun.json'), 'utf8'));
  assert.deepEqual(proof.afterModify, proof.afterRerun);
  assert.equal(proof.changed.length, 7);
  for (const changed of proof.changed) assert.ok(changed.endsWith('/actions/01-verify.md'));
  for (const [file, before] of Object.entries(proof.before)) {
    if (!proof.changed.includes(file)) assert.deepEqual(proof.afterModify[file], before, file);
  }
});

test('six native caller refusals leave full project trees unchanged', () => {
  const proof = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'caller-refusals.json'), 'utf8'));
  assert.deepEqual(proof.cases.map((c) => c.name).sort(),
    ['portable-without-consent', 'duplicate-copies', 'late-nonregular', 'symlink', 'readonly', 'escaping-reference'].sort());
  for (const refusal of proof.cases) {
    assert.deepEqual(refusal.after, refusal.before, refusal.name);
    assert.ok(refusal.decision);
  }
});

const detectionFixtures = path.join(__dirname, 'fixtures/context-generation/detection');
for (const fixture of JSON.parse(fs.readFileSync(path.join(detectionFixtures, 'cases.json'), 'utf8'))) {
  test(`skill contract detection oracle: ${fixture.name}`, () => {
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

test('golden trees match caller output hashes and every local Markdown link stays inside its skill', () => {
  const crypto = require('node:crypto');
  const proof = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'caller-modify-rerun.json'), 'utf8'));
  for (const [file, entry] of Object.entries(proof.afterModify)) {
    if (entry.type !== 'file' || !file.includes('/verify-payload/')) continue;
    const p = path.join(FIXTURES, file);
    const bytes = fs.readFileSync(p);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), entry.sha256, file);
    if (!file.endsWith('.md')) continue;
    const root = p.slice(0, p.indexOf(`${path.sep}verify-payload${path.sep}`)) + `${path.sep}verify-payload`;
    for (const link of bytes.toString().matchAll(/\]\(([^)]+)\)/gu)) {
      const resolved = path.resolve(path.dirname(p), link[1]);
      assert.ok(resolved.startsWith(`${root}${path.sep}`), file);
      assert.ok(fs.statSync(resolved).isFile(), file);
    }
  }
});

test('shared portable fields require resolution when a requested Kilo field conflicts with Codex', () => {
  const contract = read('references/tool-write.md');
  assert.match(contract, /share a destination[^\n]*common supported fields/u);
  assert.match(contract, /requested field[^\n]*incompatible[^\n]*resolution before writing/u);
  assert.match(contract, /never silently drop a requested field/u);
});

for (const [project, trace] of [['native', 'kilo-native-exact'], ['portable', 'kilo-portable']]) {
  test(`real Kilo ${project}: catalog, invocation, action and payload reads, exact answer and zero costs`, () => {
    const events = fs.readFileSync(path.join(EVIDENCE, `${trace}.jsonl`), 'utf8').trim().split('\n').map(JSON.parse);
    const catalog = JSON.parse(fs.readFileSync(path.join(EVIDENCE, `kilo-catalog-${project}.json`), 'utf8'));
    const target = project === 'native' ? '.kilo/skills' : '.agents/skills';
    const skills = catalog.filter((s) => s.name === 'verify-payload');
    assert.equal(skills.length, 1);
    assert.ok(skills[0].location.endsWith(`${project}/${target}/verify-payload/SKILL.md`));
    const tools = events.filter((e) => e.type === 'tool_use').map((e) => e.part);
    assert.ok(tools.some((p) => p.tool === 'skill' && p.state.status === 'completed' && p.state.input.name === 'verify-payload'));
    for (const suffix of ['actions/01-verify.md', 'assets/payload.txt']) {
      assert.ok(tools.some((p) => p.tool === 'read' && p.state.status === 'completed' && p.state.input.filePath.endsWith(`${target}/verify-payload/${suffix}`)));
    }
    assert.deepEqual(events.filter((e) => e.type === 'text').map((e) => e.part.text), ['PAYLOAD_APPLIED:cedar-7391']);
    const costs = events.filter((e) => e.type === 'step_finish').map((e) => e.part.cost);
    assert.ok(costs.length > 0);
    assert.ok(costs.every((cost) => cost === 0));
  });
}

test('native caller refuses an unresolved shared-field request without creating a skill', () => {
  const proof = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'caller-shared-fields-refusal.json'), 'utf8'));
  assert.deepEqual(proof.before, proof.after);
  assert.ok(Object.keys(proof.after).every((p) => !p.includes('/skills/')));
});

test('native Kilo plus a selected portable host must resolve placement before any write', () => {
  const contract = read('references/tool-write.md');
  assert.match(contract, /Kilo native[^\n]*another selected host[^\n]*resolution before writing/u);
  assert.match(contract, /never create both trees/u);
  const proof = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'caller-native-codex-refusal.json'), 'utf8'));
  assert.deepEqual(proof.before, proof.after);
});
