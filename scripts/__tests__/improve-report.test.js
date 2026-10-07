const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');
const { runInNewContext } = require('node:vm');

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

function loadReport() {
  function element(fields = {}) {
    const listeners = new Map();
    return {
      ...fields,
      addEventListener: (name, listener) => listeners.set(name, listener),
      dispatch(name) { return listeners.get(name)({ currentTarget: this }); },
    };
  }

  const prompt = element({ value: 'Manual introduction.\n\n---\nManual closing.' });
  const acceptedCount = element({ textContent: '' });
  const copy = element({ textContent: 'Copy', dataset: { labelSuccess: 'Copied' } });
  const writes = [];
  const findings = ['concise-output', 'duplicate-publishing-rule'].map((id) => {
    const classes = new Set();
    const label = { textContent: 'Accepter' };
    const input = element({
      checked: false,
      dataset: { prompt: `Apply ${id}.`, labelOff: 'Accepter', labelOn: 'Accepté' },
    });
    const finding = {
      dataset: { id },
      classes,
      input,
      label,
      classList: { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) },
      querySelector: (selector) => ({
        '.accept-input': input,
        '.accept-toggle span': label,
      })[selector],
    };
    input.closest = () => finding;
    return finding;
  });
  const document = {
    querySelector: (selector) => ({
      '#report': { dataset: { labelAcceptedOne: '{count} acceptée', labelAcceptedOther: '{count} acceptées' } },
      '#execution-prompt': prompt,
      '#accepted-count': acceptedCount,
      '#copy-prompt': copy,
    })[selector] || null,
    querySelectorAll: (selector) => ({
      '.finding': findings,
      '.accept-input': findings.map(({ input }) => input),
    })[selector] || [],
  };

  runInNewContext(readFileSync(resolve(
    __dirname,
    '../../plugins/aidd-refine/skills/05-improve/assets/report.js',
  ), 'utf8'), {
    document,
    navigator: { clipboard: { writeText: async (value) => writes.push(value) } },
    window: { setTimeout() {} },
  });
  return { prompt, acceptedCount, copy, findings, writes };
}

test('acceptance uses metadata IDs without visible ID nodes and retains manual edits', () => {
  const { prompt, acceptedCount, findings } = loadReport();
  const second = findings[1];
  second.input.checked = true;
  second.input.dispatch('change');

  assert.ok(second.classes.has('is-accepted'));
  assert.equal(second.label.textContent, 'Accepté');
  assert.equal(acceptedCount.textContent, '1 acceptée');
  assert.match(prompt.value, /\[duplicate-publishing-rule\] Apply duplicate-publishing-rule\./);

  prompt.value = prompt.value.replace('Apply duplicate-publishing-rule.', 'Keep my edited instruction.');
  second.input.checked = false;
  second.input.dispatch('change');
  assert.ok(!second.classes.has('is-accepted'));
  assert.equal(second.label.textContent, 'Accepter');
  assert.equal(acceptedCount.textContent, '0 acceptées');
  assert.doesNotMatch(prompt.value, /\[duplicate-publishing-rule\]/);

  second.input.checked = true;
  second.input.dispatch('change');
  assert.match(prompt.value, /\[duplicate-publishing-rule\] Keep my edited instruction\./);
  assert.match(prompt.value, /^Manual introduction\./);
  assert.match(prompt.value, /Manual closing\.$/);
});

test('copy reads the current editable prompt after acceptance', async () => {
  const { prompt, copy, findings, writes } = loadReport();
  findings[0].input.checked = true;
  findings[0].input.dispatch('change');
  prompt.value += '\nAn extra manual instruction.';

  await copy.dispatch('click');

  assert.deepEqual(writes, [prompt.value]);
  assert.equal(copy.textContent, 'Copied');
});
