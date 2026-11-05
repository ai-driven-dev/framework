#!/usr/bin/env node
/**
 * Fails when the shared hook library differs between the plugins that carry it, or when a
 * plugin that ships hooks does not carry the CLI's Claude Code host adapter byte for byte. Each plugin
 * ships its own copy under its hooks folder, because a plugin never reaches outside itself;
 * this check is what keeps the copies one library.
 *
 * Every copy is listed with a short hash, and the copies outside the majority are named; on a
 * tie no copy can be trusted as the reference, so every copy is named. Zero or one copy has
 * nothing to differ from.
 *
 * The host adapter has one reference, the asset the CLI builds from: a copy is held to it, not
 * to the other copies, and a plugin with a `hooks/hooks.json` but no copy is named.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const LIBRARY = path.join("hooks", "lib", "common-rules.cjs");
const HASH_LENGTH = 8;
const HOST_ADAPTER = path.join("hooks", "lib", "host.cjs");
const HOST_ADAPTER_ASSET = path.join("cli", "assets", "hooks-runtime", "host-claude.cjs");

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

function shortHash(content) {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, HASH_LENGTH);
}

function differingCopies(root = ROOT) {
  const copies = copiesUnder(root);
  // Copies are compared by their whole content; the short hash only names them in the report.
  const contents = Object.fromEntries(copies.map((copy) => [copy, fs.readFileSync(path.join(root, copy)).toString("base64")]));
  const hashes = Object.fromEntries(copies.map((copy) => [copy, shortHash(contents[copy])]));
  const counts = new Map();
  for (const content of Object.values(contents)) counts.set(content, (counts.get(content) ?? 0) + 1);
  if (counts.size < 2) return { copies, hashes, differing: [] };

  const [first, second] = [...counts.values()].sort((a, b) => b - a);
  const majority = first > second ? [...counts].find(([, count]) => count === first)[0] : null;
  const differing = copies.filter((copy) => contents[copy] !== majority);
  return { copies, hashes, differing };
}

function readOrNull(file) {
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}

function hostAdapterCopies(root = ROOT) {
  const plugins = path.join(root, "plugins");
  const shipping = fs.existsSync(plugins)
    ? fs
        .readdirSync(plugins, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .filter((entry) => fs.existsSync(path.join(plugins, entry.name, "hooks", "hooks.json")))
        .map((entry) => path.join("plugins", entry.name, HOST_ADAPTER))
        .sort()
    : [];
  const asset = readOrNull(path.join(root, HOST_ADAPTER_ASSET));
  const copies = shipping.filter((copy) => fs.existsSync(path.join(root, copy)));
  return {
    copies: copies.map(toPosix),
    differing: copies
      .filter((copy) => asset === null || !fs.readFileSync(path.join(root, copy)).equals(asset))
      .map(toPosix),
    missing: shipping.filter((copy) => !copies.includes(copy)).map(toPosix),
  };
}

function run(root = ROOT, logger = console.error, successLogger = console.log) {
  const { copies, hashes, differing } = differingCopies(root);
  const host = hostAdapterCopies(root);
  let status = 0;

  if (differing.length === 0) {
    successLogger(`✅ Hook rule copies: ${copies.length} identical`);
  } else {
    logger(`❌ the shared hook library differs between its ${copies.length} copies`);
    for (const copy of copies) logger(`  ${copy} ${hashes[copy]}${differing.includes(copy) ? "  differs" : ""}`);
    logger("  make every copy identical, then rerun");
    status = 1;
  }

  const asset = toPosix(HOST_ADAPTER_ASSET);
  if (host.differing.length === 0 && host.missing.length === 0) {
    successLogger(`✅ Host adapter copies: ${host.copies.length} identical to ${asset}`);
    return status;
  }
  logger(`❌ every plugin that ships hooks carries ${asset} as hooks/lib/host.cjs`);
  for (const copy of host.differing) logger(`  ${copy} differs from ${asset}`);
  for (const copy of host.missing) logger(`  ${copy} is missing`);
  logger(`  copy ${asset} over each one, then rerun`);
  return 1;
}

module.exports = { differingCopies, hostAdapterCopies, run };

if (require.main === module) {
  process.exit(run());
}
