const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '../../plugins/aidd-orchestrator/skills/00-async-dev');
const read = (path) => readFileSync(join(root, path), 'utf8');
const modeNames = ['setup', 'run', 'review'];
const expectedActions = {
  setup: ['detect-context', 'ask-config', 'generate-workflow', 'generate-local-script', 'write-config', 'bootstrap-labels', 'install-user-scope-plugins', 'configure-remote-secrets', 'bootstrap-scheduling', 'commit-and-push', 'smoke-test'],
  run: ['poll-ready', 'resolve-deps', 'acquire-lock', 'check-sdlc', 'delegate-sdlc', 'write-audit'],
  review: ['collect-comments', 'detect-stop', 'fix-iteration', 'finalize'],
};

test('root loads routing before exactly one selected mode', () => {
  const skill = read('SKILL.md');
  assert.match(skill, /actions\/route\.md/);
  for (const mode of modeNames) {
    assert.match(skill, new RegExp(`actions/${mode}\\.md`));
    assert.doesNotMatch(skill, new RegExp(`actions/${mode}/01-`));
  }
  assert.doesNotMatch(skill, /## Routing: hybrid contract|### Setup \(11 actions\)|### Run \(6 actions\)|### Review \(4 actions\)/);
});

test('routing reference owns aliases, precedence, and conflict decisions', () => {
  const route = read('actions/route.md');
  const reference = read('references/routing.md');
  assert.match(route, /references\/routing\.md/);
  assert.match(reference, /action=<keyword>/);
  assert.match(reference, /@claude\\s\+\/\(implement\|aidd-dev:02-implement\|run\)/);
  assert.match(reference, /@claude\\s\+\/\(review\|aidd-dev:05-review\)/);
  assert.match(reference, /to-implement.*to-review/s);
  assert.match(reference, /config is absent/);
  assert.match(reference, /open closing PR/);
  assert.match(reference, /Unresolved: ask the human/);
});

for (const mode of modeNames) {
  test(`${mode} loads only its ordered actions`, () => {
    const sequence = read(`actions/${mode}.md`);
    let prior = -1;
    expectedActions[mode].forEach((action, index) => {
      const path = `actions/${mode}/${String(index + 1).padStart(2, '0')}-${action}.md`;
      const position = sequence.indexOf(path);
      assert.ok(position > prior, `${path} missing or out of order`);
      prior = position;
    });
    for (const other of modeNames.filter((name) => name !== mode)) {
      assert.doesNotMatch(sequence, new RegExp(`actions/${other}/`));
    }
  });
}

test('run retains runtime SDLC discovery', () => {
  assert.match(read('actions/run.md'), /04-check-sdlc\.md/);
  assert.match(read('actions/run/04-check-sdlc.md'), /Match by description, not by hardcoded name/);
});
