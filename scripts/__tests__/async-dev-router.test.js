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

test('documented scenarios preserve the baseline selection outcomes', () => {
  const route = read('actions/route.md');
  const reference = read('references/routing.md');
  const evidence = readFileSync(join(__dirname, '../../aidd_docs/tasks/2026_10/2026_10_20_delivery-loop-router/evidence.md'), 'utf8');
  const scenarios = [
    ['Arguments exactly `RUN`', 'run', /arguments are exactly `setup`, `run`, or `review` \(case-insensitive\)/],
    ['Prompt `action=review on PR #17`', 'review', /prompt contains `action=<keyword>` as a standalone token/],
    ['label `to-implement`', 'run', /label `to-implement`\s+\| `run`/],
    ['label `to-review`', 'review', /label `to-review`\s+\| `review`/],
    ['`@claude \/aidd-dev:02-implement`', 'run', /@claude\\s\+\/\(implement\|aidd-dev:02-implement\|run\)/],
    ['`@claude \/aidd-dev:05-review`', 'review', /@claude\\s\+\/\(review\|aidd-dev:05-review\)/],
    ['input `action=setup`', 'setup', /workflow_dispatch` \+ input `action=<X>`/],
    ['Workflow and config both absent', 'setup', /aidd-async\.yml` missing AND `.claude\/aidd-orchestrator\.json` missing\s+\| `setup`/],
    ['Workflow present, config absent', 'setup', /orchestrator\.json` missing but workflow present.*`setup` \(incomplete install\)/],
    ['Open PR closes referenced issue', 'review', /Open PR closes the referenced issue\s+\| `review`/],
    ['Fresh issue, no linked PR', 'run', /Fresh issue with no linked PR \+ intent to implement\s+\| `run`/],
    ['`bootstrap async dev`', 'setup', /`bootstrap`.*`setup`/],
    ['`pick up the queue`', 'run', /`pick up the queue`.*`run`/],
    ['`apply feedback`', 'review', /`apply feedback`.*`review`/],
    ['`action=review` and label `to-implement`', 'review', /Arguments keyword \(1\) > trigger env \(2\)/],
    ['User requests run, config absent', 'stop, request setup', /User says "run" but config is absent[\s\S]*?Surface the conflict and stop/],
    ['Webhook `to-implement`, open closing PR', 'review, comment', /Workflow webhook fires `to-implement` but the issue already has an open closing PR[\s\S]*?Route to `review`/],
    ['Both `to-implement` and `to-review` labels', 'review, comment', /Label `to-implement` AND label `to-review` both present[\s\S]*?Route to `review`/],
    ['No matching arguments, trigger, state, or intent', 'ask which mode', /If none of the above produces a single match[\s\S]*?ask/],
  ];
  for (const [input, outcome, contract] of scenarios) {
    const row = evidence.split('\n').find((line) => line.startsWith('| ') && line.includes(input));
    assert.ok(row, `missing scenario: ${input}`);
    assert.ok(row.endsWith(`| ${outcome} | ${outcome} |`), `baseline/new mismatch: ${input}`);
    assert.match(reference, contract, `missing selection contract: ${input}`);
  }
  assert.match(route, /resolves a conflict to a mode, load that mode/);
  assert.match(route, /Stop before loading a mode only when.*blocking or the signals unresolved/);
  assert.match(evidence, /Runtime LLM selection and mode execution remain unverified/);
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
