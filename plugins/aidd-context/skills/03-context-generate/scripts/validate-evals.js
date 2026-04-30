#!/usr/bin/env node
/**
 * @file scripts/validate-evals.js
 * @description Validates `evals/scenarios.json` for R10 compliance and
 * cross-references every `should` scenario's `expect_action` against the
 * actual files in `actions/`.
 *
 * Checks performed:
 *  - File exists and parses as a JSON array.
 *  - Total count ≥ 3 (R10).
 *  - At least 3 `should`, 3 `should_not`, 1 `ambiguous` scenarios (R10).
 *  - Per-scenario shape:
 *      `should`     → has a concrete `expect_action` slug that maps to a
 *                     file in `actions/` (when `actions/` exists).
 *      `should_not` → `expect_action` is `null` and `competing_skill` is set
 *                     (use `"none"` if no competing skill exists).
 *      `ambiguous`  → `expect_action` equals `"ask_clarification"`.
 *  - No two scenarios share the exact same prompt.
 *
 * @example Usage
 *   node validate-evals.js                            // validates this skill
 *   node validate-evals.js <path-to-target-skill>     // validates a target
 *
 * @exits 0 on success, 1 on validation failure.
 */

const fs = require('fs');
const path = require('path');

/** @type {string|undefined} */
const target = process.argv[2];

/** @type {string} Resolved absolute path of the skill being validated. */
const SKILL_DIR = target ? path.resolve(target) : path.resolve(__dirname, '..');
process.chdir(SKILL_DIR);

/**
 * Print a multi-line failure diagnostic and exit non-zero.
 * @param {string} msg - Human-readable diagnostic; line-breaks are preserved with indentation.
 * @returns {never}
 */
function fail(msg) {
  console.error(`FAIL (validate-evals @ ${SKILL_DIR}):\n  ${msg.split('\n').join('\n  ')}`);
  process.exit(1);
}

const EVALS_PATH = 'evals/scenarios.json';
if (!fs.existsSync(EVALS_PATH)) fail(`${EVALS_PATH} not found`);

/** @type {Array<object>} */
let scenarios;
try {
  scenarios = JSON.parse(fs.readFileSync(EVALS_PATH, 'utf8'));
} catch (e) {
  fail(`${EVALS_PATH} is not valid JSON: ${e.message}`);
}

if (!Array.isArray(scenarios)) fail('scenarios must be a JSON array');
if (scenarios.length < 3) fail(`at least 3 scenarios required, got ${scenarios.length} (R10)`);

/** @type {Set<string>} Slugs derived from `actions/` file names (used for cross-ref). */
const actionSlugs = new Set();
if (fs.existsSync('actions')) {
  for (const f of fs.readdirSync('actions')) {
    if (!f.endsWith('.md')) continue;
    actionSlugs.add(f.replace(/^\d+-/, '').replace(/\.md$/, ''));
  }
}

/** @type {{should:number, should_not:number, ambiguous:number}} */
const counts = { should: 0, should_not: 0, ambiguous: 0 };

/** @type {string[]} */
const errors = [];

scenarios.forEach((s, i) => {
  const loc = `scenario #${i}`;
  if (!s.type) { errors.push(`${loc}: missing "type"`); return; }
  counts[s.type] = (counts[s.type] || 0) + 1;

  if (!s.prompt || typeof s.prompt !== 'string') errors.push(`${loc}: "prompt" missing or not a string`);
  if (!('expect_action' in s)) errors.push(`${loc}: missing "expect_action" key`);

  switch (s.type) {
    case 'should':
      if (!s.expect_action || s.expect_action === 'ask_clarification') {
        errors.push(`${loc}: "should" scenarios must have a concrete expect_action slug`);
      } else if (actionSlugs.size > 0 && !actionSlugs.has(s.expect_action)) {
        errors.push(`${loc}: expect_action "${s.expect_action}" does not match any file in actions/`);
      }
      break;
    case 'should_not':
      if (s.expect_action !== null) {
        errors.push(`${loc}: "should_not" scenarios must have expect_action: null`);
      }
      if (!s.competing_skill) {
        errors.push(`${loc}: "should_not" scenarios must declare competing_skill (use "none" if none exists)`);
      }
      break;
    case 'ambiguous':
      if (s.expect_action !== 'ask_clarification') {
        errors.push(`${loc}: "ambiguous" scenarios must have expect_action: "ask_clarification"`);
      }
      break;
    default:
      errors.push(`${loc}: unknown type "${s.type}" — expected should | should_not | ambiguous`);
  }
});

if (counts.should < 3) errors.push(`R10: at least 3 "should" scenarios required, got ${counts.should}`);
if (counts.should_not < 3) errors.push(`R10: at least 3 "should_not" scenarios required, got ${counts.should_not}`);
if (counts.ambiguous < 1) errors.push(`R10: at least 1 "ambiguous" scenario required, got ${counts.ambiguous}`);

const prompts = scenarios.map(s => (s.prompt || '').trim().toLowerCase());
const seen = new Set();
for (const p of prompts) {
  if (p && seen.has(p)) errors.push(`duplicate prompt: "${p}"`);
  seen.add(p);
}

if (errors.length) fail(errors.join('\n'));

console.log(`OK (${path.basename(SKILL_DIR)}): ${scenarios.length} scenarios (${counts.should} should, ${counts.should_not} should_not, ${counts.ambiguous} ambiguous) — cross-ref=${actionSlugs.size} actions`);
