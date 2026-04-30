#!/usr/bin/env node
/**
 * @file scripts/validate-all.js
 * @description Convenience runner for the three structural validators
 * (validate-skill-md, validate-actions, validate-evals) of a target skill.
 *
 * Uses {@link https://nodejs.org/api/child_process.html#child_processspawnsyncfile-args-options spawnSync}
 * with an explicit args array so the target path cannot be interpreted by
 * the shell — safe against path-injection and special characters.
 *
 * @example Usage
 *   node validate-all.js                            // validates this skill
 *   node validate-all.js <path-to-target-skill>     // validates a target
 *
 * @exits 0 when every validator returns 0; 1 if any validator fails.
 */

const { spawnSync } = require('child_process');
const path = require('path');

/** @type {string|undefined} */
const target = process.argv[2];

/** @type {string} Resolved absolute path of the skill being validated. */
const SKILL_DIR = target ? path.resolve(target) : path.resolve(__dirname, '..');

/** @type {string} Absolute path to this scripts directory. */
const SCRIPTS_DIR = __dirname;

/** @type {string[]} Validators to run, in order. */
const scripts = ['validate-skill-md.js', 'validate-actions.js', 'validate-evals.js'];

let failed = 0;

for (const s of scripts) {
  const result = spawnSync('node', [path.join(SCRIPTS_DIR, s), SKILL_DIR], { stdio: 'inherit' });
  if (result.status !== 0) failed += 1;
}

if (failed) {
  console.error(`\n${failed} / ${scripts.length} validators failed (target: ${SKILL_DIR})`);
  process.exit(1);
}
console.log(`\nAll ${scripts.length} validators passed (target: ${SKILL_DIR})`);
