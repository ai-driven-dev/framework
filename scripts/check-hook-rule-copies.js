#!/usr/bin/env node
/**
 * Fails when the shared hook library differs between the plugins that carry it. Each plugin
 * ships its own copy under its hooks folder, because a plugin never reaches outside itself;
 * this check is what keeps the copies one library.
 *
 * Every copy is compared byte for byte with the first, in sorted order, and each one that
 * differs is named. Zero or one copy has nothing to differ from.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const LIBRARY = path.join("hooks", "lib", "common-rules.cjs");

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

function differingCopies(root = ROOT) {
  const copies = copiesUnder(root);
  if (copies.length < 2) return { copies, reference: copies[0], differing: [] };

  const [reference, ...others] = copies;
  const expected = fs.readFileSync(path.join(root, reference));
  const differing = others.filter((copy) => !fs.readFileSync(path.join(root, copy)).equals(expected));
  return { copies, reference, differing };
}

function run(root = ROOT, logger = console.error, successLogger = console.log) {
  const { copies, reference, differing } = differingCopies(root);

  if (differing.length === 0) {
    successLogger(`✅ Hook rule copies: ${copies.length} identical`);
    return 0;
  }

  logger(`❌ ${differing.length} copy(ies) of the shared hook library differ from ${reference}`);
  for (const copy of differing) logger(`  ${copy}: copy ${reference} over it`);
  return 1;
}

module.exports = { differingCopies, run };

if (require.main === module) {
  process.exit(run());
}
