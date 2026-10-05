const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const test = require('node:test');

const { composePrompt, formatCount } = require(resolve(
  __dirname,
  '../../plugins/aidd-refine/skills/05-improve/assets/report.js',
));

test('accepted edits keep report order and preserve manual prompt text', () => {
  const saved = new Map();
  const known = new Set(['F-001', 'F-002']);
  const base = [
    'User introduction.',
    '',
    'Accepted changes:',
    '- [NOTE] Keep this manual note.',
    '',
    '---',
    '',
    'User closing.',
  ].join('\n');

  let value = composePrompt(base, [{ id: 'F-002', prompt: 'Second edit.' }], saved, known);
  value = value.replace('- [F-002] Second edit.', '- [F-002] Second edit, manually refined.');
  value = composePrompt(value, [
    { id: 'F-001', prompt: 'First edit.' },
    { id: 'F-002', prompt: 'Second edit.' },
  ], saved, known);

  assert.ok(value.indexOf('[F-001]') < value.indexOf('[F-002]'));
  assert.match(value, /\[F-002\] Second edit, manually refined\./);
  assert.match(value, /^User introduction\./);
  assert.match(value, /- \[NOTE\] Keep this manual note\./);
  assert.match(value, /User closing\.$/);
  assert.ok(value.indexOf('[F-002]') < value.indexOf('---'));

  value = composePrompt(value, [{ id: 'F-001', prompt: 'First edit.' }], saved, known);
  assert.doesNotMatch(value, /\[F-002\]/);
  value = composePrompt(value, [
    { id: 'F-001', prompt: 'First edit.' },
    { id: 'F-002', prompt: 'Second edit.' },
  ], saved, known);
  assert.match(value, /\[F-002\] Second edit, manually refined\./);
  assert.equal(composePrompt(value, [
    { id: 'F-001', prompt: 'First edit.' },
    { id: 'F-002', prompt: 'Second edit.' },
  ], saved, known), value);
});

test('prompt insertion is independent of localized headings', () => {
  for (const [heading, closing] of [
    ['Accepted changes:', 'After validation, propose one improvement.'],
    ['Changements acceptés :', 'Après validation, propose une amélioration.'],
  ]) {
    const base = ['Introduction.', '', heading, '', '---', '', closing].join('\n');
    const value = composePrompt(base, [{ id: 'F-001', prompt: 'Apply the edit.' }]);

    assert.ok(value.indexOf('[F-001]') < value.indexOf('---'));
    assert.ok(value.indexOf('---') < value.indexOf(closing));
    assert.match(value, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('missing prompt marker preserves manual text and appends accepted edits safely', () => {
  const base = ['Manual introduction.', '', 'Manual closing.'].join('\n');
  const value = composePrompt(base, [{ id: 'F-001', prompt: 'Apply the edit.' }]);

  assert.match(value, /^Manual introduction\./);
  assert.match(value, /Manual closing\./);
  assert.ok(value.indexOf('Manual closing.') < value.indexOf('[F-001]'));
});

test('count labels come from localized HTML data', () => {
  assert.equal(formatCount(1, '{count} recommendation', '{count} recommendations'), '1 recommendation');
  assert.equal(formatCount(2, '{count} recommandation', '{count} recommandations'), '2 recommandations');
});
