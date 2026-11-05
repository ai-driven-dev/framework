#!/usr/bin/env node
/**
 * Fails when the shared hook library differs between the plugins that carry it. Each plugin
 * ships its own copy under its hooks folder, because a plugin never reaches outside itself;
 * this check is what keeps the copies one library.
 *
 * Every copy is listed with a short hash, and the copies outside the majority are named; on a
 * tie no copy can be trusted as the reference, so every copy is named. Zero or one copy has
 * nothing to differ from.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const LIBRARY = path.join("hooks", "lib", "common-rules.cjs");
const HASH_LENGTH = 8;

function toPosix(file) {
  return file.split(path.sep).join("/");
}

function copiesUnder(root) {
  const plugins = path.join(root, "plugins");
  if (!fs.existsSync(plugins)) return [];

  return fs
    .readdirSync(plugins, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join("plugins", entry.name, LIBRARY))
    .filter((copy) => fs.existsSync(path.join(root, copy)))
    .map(toPosix)
    .sort();
}

function shortHash(root, copy) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, copy))).digest("hex").slice(0, HASH_LENGTH);
}

function differingCopies(root = ROOT) {
  const copies = copiesUnder(root);
  const hashes = Object.fromEntries(copies.map((copy) => [copy, shortHash(root, copy)]));
  const counts = new Map();
  for (const hash of Object.values(hashes)) counts.set(hash, (counts.get(hash) ?? 0) + 1);
  if (counts.size < 2) return { copies, hashes, differing: [] };

  const [first, second] = [...counts.values()].sort((a, b) => b - a);
  const majority = first > second ? [...counts].find(([, count]) => count === first)[0] : null;
  const differing = copies.filter((copy) => hashes[copy] !== majority);
  return { copies, hashes, differing };
}

function run(root = ROOT, logger = console.error, successLogger = console.log) {
  const { copies, hashes, differing } = differingCopies(root);

  if (differing.length === 0) {
    successLogger(`✅ Hook rule copies: ${copies.length} identical`);
    return 0;
  }

  logger(`❌ the shared hook library differs between its ${copies.length} copies`);
  for (const copy of copies) logger(`  ${copy} ${hashes[copy]}${differing.includes(copy) ? "  differs" : ""}`);
  logger("  make every copy identical, then rerun");
  return 1;
}

module.exports = { differingCopies, run };

if (require.main === module) {
  process.exit(run());
}
