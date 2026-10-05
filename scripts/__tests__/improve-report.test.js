const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const test = require('node:test');

const { composePrompt } = require(resolve(
  __dirname,
  '../../plugins/aidd-refine/skills/05-improve/assets/report.js',
));

test('accepted edits keep report order and preserve manual prompt text', () => {
  const saved = new Map();
  const known = new Set(['F-001', 'F-002']);
  const base = [
    'User introduction.',
    '',
    'Changements acceptés :',
    '- [NOTE] Keep this manual note.',
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
