const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../..');
const hook = (file) => fs.readFileSync(path.join(ROOT, 'plugins/aidd-context/skills/08-hook-generate', file), 'utf8');
const fixture = (file) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/context-generation/hooks/mixed', file), 'utf8'));

test('contract: plugin-only requests run through no-write validation', () => {
  const paths = hook('references/tool-paths.md');
  const router = hook('SKILL.md');
  const capture = hook('actions/01-capture-hook.md');
  const write = hook('actions/02-write-hook.md');
  const validate = hook('actions/03-validate.md');
  const evalCase = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/skill-eval/cases.json'), 'utf8'))
    .find((item) => item.name === 'Kilo-only session start gives guidance without files');
  const evalCases = evalCase.expect;
  assert.match(paths, /official project path explicitly documented[\s\S]*`\.kilo\/plugin\/`/u);
  assert.match(paths, /Do not present `\.kilo\/plugins\/` as a confirmed project path/u);
  assert.match(paths, /These paths are Kilo-supported, not AIDD output destinations/u);
  assert.match(paths, /AIDD does not generate a Kilo plugin or hook/u);
  assert.match(paths, /https:\/\/kilo\.ai\/docs\/automate\/extending\/plugins/u);
  assert.match(paths, /session\.created/u);
  assert.match(paths, /unsupported.*no.*fallback/iu);
  assert.match(paths, /\| OpenCode\s+\| guidance/u);
  assert.match(paths, /\| Kilo\s+\| guidance/u);
  assert.match(paths, /\.opencode\/plugins\//u);
  assert.match(paths, /These paths are OpenCode-supported, not AIDD output destinations/u);
  assert.match(router, /Run actions `01 → 02 → 03`[\s\S]*guidance-only/u);
  assert.match(capture, /OpenCode and Kilo are plugin-guidance targets/u);
  assert.match(capture, /record the project tree's paths and file bytes before continuing/u);
  assert.match(capture, /guidance-only targets require neither/u);
  assert.match(write, /A guidance-only request writes nothing and continues to action 03/u);
  assert.match(validate, /For a guidance-only request, compare the complete project tree before and after: no write/u);
  assert.match(validate, /For mixed requests, confirm no plugin-only hook, config, script, or plugin was added/u);
  assert.match(evalCase.prompt, /Explicitly state that the docs do not confirm \.kilo\/plugins\//u);
  assert.ok(evalCases.stdoutMatches.includes('\\.kilo/plugin/'));
  assert.ok(evalCases.stdoutMatches.includes('session\\.created'));
  assert.equal(evalCases.projectTreeUnchanged, true);
  assert.match(evalCases.judge, /explicitly states that \.kilo\/plugins\/ is not a confirmed project path/u);
  assert.equal(evalCases.stdoutNotContains, undefined);
});

test('contract: event mapping requires documented semantics and rejects nearby substitutions', () => {
  const authoring = hook('references/hook-authoring.md');
  const paths = hook('references/tool-paths.md');
  const capture = hook('actions/01-capture-hook.md');
  const write = hook('actions/02-write-hook.md');
  const validate = hook('actions/03-validate.md');
  assert.match(authoring, /semantic equivalence[\s\S]*timing, matcher, payload, and blocking behavior are documented/u);
  assert.match(authoring, /A nearby event is not equivalent by proximity/u);
  assert.match(authoring, /do not publish for that target[\s\S]*explicit confirmation/u);
  assert.doesNotMatch(authoring, /fold it into the nearest|consider a nearest documented supported moment/u);
  assert.match(paths, /\| session start\s+\| `SessionStart`\s+\| `SessionStart`\s+\| `sessionStart`\s+\| `SessionStart`/u);
  assert.match(paths, /\| after a tool fails\s+\| `PostToolUseFailure`\s+\| -\s+\| `postToolUseFailure`\s+\| `PostToolUseFailure`/u);
  assert.match(paths, /Codex `PostToolUse`[\s\S]*not an automatic equivalent of "after a tool fails"/u);
  assert.match(capture, /skip publication for that target and explain why/u);
  assert.match(write, /Exclude targets without a documented equivalent event or required properties/u);
  assert.match(validate, /A merely nearby event is not an equivalent/u);
});

test('eval cases cover supported, absent, nearby and mixed plugin-only targets', () => {
  const cases = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/skill-eval/cases.json'), 'utf8'));
  const named = (name) => {
    const found = cases.find((item) => item.name === name);
    assert.ok(found, name);
    return found;
  };
  const openCode = named('OpenCode-only session start gives plugin guidance without files');
  assert.ok(openCode.expect.filesAbsent.includes('.opencode/plugins/aidd-hook.ts'));
  assert.ok(openCode.expect.filesUnchanged.includes('opencode.json'));
  assert.equal(openCode.expect.projectTreeUnchanged, true);
  const supported = named('declarative session start keeps documented event names');
  assert.match(supported.prompt, /Claude, Codex, Cursor and Copilot/u);
  assert.deepEqual(supported.expect.jsonValid, [
    '.claude/settings.json', '.codex/hooks.json', '.cursor/hooks.json', '.github/hooks/aidd.json',
  ]);
  assert.match(supported.expect.fileMatches['.claude/settings.json'], /SessionStart/u);
  assert.match(supported.expect.fileMatches['.codex/hooks.json'], /SessionStart/u);
  assert.match(supported.expect.fileMatches['.cursor/hooks.json'], /sessionStart/u);
  assert.match(supported.expect.fileMatches['.github/hooks/aidd.json'], /SessionStart/u);
  for (const pattern of Object.values(supported.expect.fileMatches)) assert.doesNotThrow(() => new RegExp(pattern));
  assert.deepEqual(supported.expect.fileNotContains['.claude/settings.json'], ['"matcher"']);
  assert.deepEqual(supported.expect.fileNotContains['.codex/hooks.json'], ['"matcher"']);
  const supportedWithoutCodex = named('declarative session start publishes supported non-Codex targets');
  assert.ok(supportedWithoutCodex.expect.filesExist.includes('.cursor/hooks.json'));
  assert.ok(supportedWithoutCodex.expect.filesAbsent.includes('.codex/hooks.json'));
  assert.deepEqual(supportedWithoutCodex.expect.jsonValid, [
    '.claude/settings.json', '.cursor/hooks.json', '.github/hooks/aidd.json',
  ]);
  assert.match(supportedWithoutCodex.expect.fileMatches['.claude/settings.json'], /SessionStart/u);
  assert.match(supportedWithoutCodex.expect.fileMatches['.cursor/hooks.json'], /sessionStart/u);
  assert.match(supportedWithoutCodex.expect.fileMatches['.github/hooks/aidd.json'], /SessionStart/u);
  for (const pattern of Object.values(supportedWithoutCodex.expect.fileMatches)) assert.doesNotThrow(() => new RegExp(pattern));
  assert.deepEqual(supportedWithoutCodex.expect.fileNotContains['.claude/settings.json'], ['"matcher"']);
  const absent = named('unsupported exact moment skips every declarative target');
  assert.ok(absent.expect.filesAbsent.includes('.claude/settings.json'));
  const nearby = named('tool failure does not become Codex PostToolUse');
  assert.ok(nearby.expect.filesAbsent.includes('.codex/hooks.json'));
  assert.match(nearby.expect.judge, /success as well as failure/u);
  const mixed = named('plugin-only guidance and declarative hook stay separate');
  assert.ok(mixed.expect.filesAbsent.includes('.kilo/hooks.json'));
  assert.ok(mixed.expect.filesAbsent.includes('.opencode/plugins/aidd-hook.ts'));
});

test('static contract: mixed hooks preflight before writes and preserve user hooks', () => {
  const write = hook('actions/02-write-hook.md');
  const validate = hook('actions/03-validate.md');
  assert.ok(write.indexOf('**Preflight.**') < write.indexOf('**Script.**'));
  const preflight = write.match(/2\. \*\*Preflight\.\*\*([\s\S]*?)(?=\n3\. \*\*Script\.\*\*)/u)?.[1] ?? '';
  assert.match(write, /exact AIDD entry/u);
  assert.match(write, /preserve.*user.*duplicate/iu);
  assert.match(preflight, /If any target is invalid, abort before any write/u);
  assert.match(validate, /second declarative pass.*byte.identical/iu);
});

test('fixture contract: mixed hook configurations retain user duplicates and one AIDD entry per target', () => {
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

test('fixture contract: invalid final mixed target has no earlier generated files', () => {
  const base = path.join(__dirname, 'fixtures/context-generation/hooks/invalid');
  const copilot = JSON.parse(fs.readFileSync(path.join(base, '.github/hooks/aidd.json'), 'utf8'));
  assert.equal(typeof copilot.hooks.SessionStart, 'string');
  assert.equal(fs.existsSync(path.join(base, '.claude/settings.json')), false);
  assert.equal(fs.existsSync(path.join(base, 'hooks/aidd.sh')), false);
  assert.equal(fs.existsSync(path.join(base, '.kilo/hooks.json')), false);
});
