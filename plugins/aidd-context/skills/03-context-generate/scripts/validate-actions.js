#!/usr/bin/env node
/**
 * @file scripts/validate-actions.js
 * @description Validates that the SKILL.md `## Available actions` table and
 * the contents of `actions/` are in sync, and that every action file has
 * the four required sections.
 *
 * Checks performed:
 *  - `actions/` directory exists.
 *  - The slugs declared in the SKILL.md table (one slug per row, parsed from
 *    backticked names in the second column) match exactly the file names in
 *    `actions/`. The numeric prefix (`01-`, `02-`, ...) is stripped before
 *    comparison.
 *  - Every `actions/*.md` file contains `## Inputs`, `## Outputs`,
 *    `## Process`, and `## Test`.
 *
 * @example Usage
 *   node validate-actions.js                            // validates this skill
 *   node validate-actions.js <path-to-target-skill>     // validates a target
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
 * Print a failure diagnostic and exit non-zero.
 * @param {string} msg - Human-readable diagnostic.
 * @returns {never}
 */
function fail(msg) {
  console.error(`FAIL (validate-actions @ ${SKILL_DIR}): ${msg}`);
  process.exit(1);
}

if (!fs.existsSync('SKILL.md')) fail('SKILL.md not found');
if (!fs.existsSync('actions')) fail('actions/ directory missing');

const skillMd = fs.readFileSync('SKILL.md', 'utf8');

/** @type {Set<string>} Slugs declared in the SKILL.md action table. */
const tableSlugs = new Set();
const tableRe = /\|\s*\d+\s*\|\s*`([a-z0-9-]+)`/g;
let m;
while ((m = tableRe.exec(skillMd))) tableSlugs.add(m[1]);

/** @type {Set<string>} Slugs derived from `actions/` file names. */
const fileSlugs = new Set();
for (const f of fs.readdirSync('actions')) {
  if (!f.endsWith('.md')) continue;
  const slug = f.replace(/^\d+-/, '').replace(/\.md$/, '');
  fileSlugs.add(slug);
}

const missing = [...tableSlugs].filter(s => !fileSlugs.has(s));
const extra = [...fileSlugs].filter(s => !tableSlugs.has(s));
if (missing.length) fail(`in SKILL.md table but no matching file in actions/: ${missing.join(', ')}`);
if (extra.length) fail(`file present in actions/ but missing from SKILL.md table: ${extra.join(', ')}`);

/** @type {string[]} Sections every action file must contain (R9). */
const required = ['## Inputs', '## Outputs', '## Process', '## Test'];

const errors = [];
for (const f of fs.readdirSync('actions')) {
  if (!f.endsWith('.md')) continue;
  const body = fs.readFileSync(path.join('actions', f), 'utf8');
  for (const section of required) {
    if (!body.includes(section)) errors.push(`${f}: missing "${section}"`);
  }
}
if (errors.length) fail(errors.join('\n'));

console.log(`OK (${path.basename(SKILL_DIR)}): ${fileSlugs.size} actions, table/files in sync, required sections present`);
