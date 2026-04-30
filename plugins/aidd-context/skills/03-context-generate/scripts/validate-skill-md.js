#!/usr/bin/env node
/**
 * @file scripts/validate-skill-md.js
 * @description Validates a skill's SKILL.md against rules R1, R4, R5, R6.
 *
 * Checks performed:
 *  - YAML frontmatter present and well-formed (delimited by `---` lines).
 *  - `name` field exists, lowercase letters/digits/hyphens only, ≤ 64 chars,
 *    no reserved words (`anthropic`, `claude`).
 *  - `description` field exists, non-empty, ≤ 1024 chars, contains a
 *    "Do NOT use ..." exclusion clause (R6).
 *  - SKILL.md body ≤ 500 lines (R4).
 *
 * Implementation note: YAML frontmatter is parsed with a minimal regex
 * that handles the two fields required by the Anthropic spec (`name`,
 * `description`) on single-line values. Optional fields placed after them
 * (`version`, `license`, `author`, etc.) are tolerated and silently
 * ignored — they are not validated. Multi-line YAML values, folded blocks,
 * and nested mappings are NOT supported. If you need them, replace this
 * parser with a YAML dependency such as `js-yaml`.
 *
 * @example Usage
 *   node validate-skill-md.js                            // validates this skill
 *   node validate-skill-md.js <path-to-target-skill>     // validates a target
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
  console.error(`FAIL (validate-skill-md @ ${SKILL_DIR}): ${msg}`);
  process.exit(1);
}

if (!fs.existsSync('SKILL.md')) fail('SKILL.md not found at skill root');

const content = fs.readFileSync('SKILL.md', 'utf8');
if (!content.startsWith('---\n')) fail('missing YAML frontmatter');

const parts = content.split('---\n');
if (parts.length < 3) fail('malformed frontmatter — expected opening and closing `---`');

const fm = parts[1];
const body = parts.slice(2).join('---\n');

const nameMatch = fm.match(/^name:\s*(.+)$/m);
const descMatch = fm.match(/^description:\s*([\s\S]+?)(?=\n[A-Za-z_][A-Za-z0-9_]*:|$)/m);
if (!nameMatch) fail('missing `name` in frontmatter');
if (!descMatch) fail('missing `description` in frontmatter');

const name = nameMatch[1].trim();
const description = descMatch[1].trim();

if (name.length > 64) fail(`name too long: ${name.length} > 64`);
if (!/^[a-z0-9-]+$/.test(name)) fail(`name must be lowercase letters/digits/hyphens only: "${name}"`);
for (const reserved of ['anthropic', 'claude']) {
  if (name.includes(reserved)) fail(`name contains reserved word "${reserved}": ${name}`);
}

if (description.length === 0) fail('description is empty');
if (description.length > 1024) fail(`description too long: ${description.length} > 1024`);
if (!/do\s*not\s*use/i.test(description)) fail('description missing exclusion clause (R6): expected "Do NOT use for ..."');

const bodyLines = body.split('\n').length;
if (bodyLines > 500) fail(`body too long: ${bodyLines} > 500 lines (R4)`);

console.log(`OK (${path.basename(SKILL_DIR)}): SKILL.md — name="${name}" (${name.length}ch), description=${description.length}ch, body=${bodyLines} lines`);
