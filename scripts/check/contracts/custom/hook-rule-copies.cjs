"use strict";
// The shared hook library is one file across the plugins that carry it, and a plugin carries the CLI's host adapter byte for byte exactly when a hook of it requires it. Anchor: marketplace.json.
// Each plugin ships its own copy under its hooks folder, because a plugin never reaches outside itself; this check keeps the copies one library.
// Library copies are compared to the majority (a tie names every copy); the host adapter has one reference, the asset the CLI builds from.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

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

function differingCopies(root) {
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

function scriptsUnder(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return scriptsUnder(full);
    return /\.c?js$/u.test(entry.name) ? [full] : [];
  });
}

/** Whether a script under the plugin's hooks folder requires the library, from `hooks/` or `hooks/lib/`. */
function requiresLibrary(pluginDir, library) {
  const name = path.basename(library).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const pattern = new RegExp(`require\\(\\s*["']\\./(?:lib/)?${name}["']\\s*\\)`, "u");
  return scriptsUnder(path.join(pluginDir, "hooks")).some((script) => pattern.test(fs.readFileSync(script, "utf8")));
}

/** A plugin carries the library when its hooks read it, and only then. */
function hostAdapterCopies(root) {
  const plugins = path.join(root, "plugins");
  const names = fs.existsSync(plugins)
    ? fs
        .readdirSync(plugins, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    : [];
  const copy = (name) => path.join("plugins", name, HOST_ADAPTER);
  const present = names.filter((name) => fs.existsSync(path.join(root, copy(name))));
  const required = names.filter((name) => requiresLibrary(path.join(plugins, name), HOST_ADAPTER));
  const asset = readOrNull(path.join(root, HOST_ADAPTER_ASSET));
  return {
    copies: present.map((name) => toPosix(copy(name))),
    differing: present
      .filter((name) => asset === null || !fs.readFileSync(path.join(root, copy(name))).equals(asset))
      .map((name) => toPosix(copy(name))),
    missing: required.filter((name) => !present.includes(name)).map((name) => toPosix(copy(name))),
    unused: present.filter((name) => !required.includes(name)).map((name) => toPosix(copy(name))),
  };
}

/** The shared library's copies that no hook of their plugin requires. */
function unusedLibraryCopies(root) {
  return copiesUnder(root).filter((copy) => !requiresLibrary(path.join(root, path.dirname(path.dirname(path.dirname(copy)))), LIBRARY));
}

module.exports = (ctx) => {
  const root = path.resolve(path.dirname(ctx.abs), "..");
  const asset = toPosix(HOST_ADAPTER_ASSET);
  const host = hostAdapterCopies(root);
  const found = [];
  const say = (fix, copy) => found.push({ file: path.relative(ctx.root, path.join(root, copy)), line: 1, offending: copy, fix });
  for (const copy of differingCopies(root).differing) say(`differs from the other copies of the shared hook library, make every copy identical`, copy);
  for (const copy of unusedLibraryCopies(root)) say(`is required by no hook, delete it`, copy);
  for (const copy of host.differing) say(`differs from ${asset}, copy the asset over it`, copy);
  for (const copy of host.missing) say(`is missing while a hook requires it, copy ${asset} there`, copy);
  for (const copy of host.unused) say(`is required by no hook, delete it`, copy);
  return found;
};
module.exports.differingCopies = differingCopies;
module.exports.hostAdapterCopies = hostAdapterCopies;
module.exports.unusedLibraryCopies = unusedLibraryCopies;
module.exports.HOST_ADAPTER_ASSET = HOST_ADAPTER_ASSET;
