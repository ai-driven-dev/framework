"use strict";
// The shared hook library of each plugin stays one library, and a copy no hook of its plugin requires is named. Anchor: marketplace.json.
// Each plugin ships its own copy under its hooks folder, because a plugin never reaches outside itself. The host adapter is not checked here: sync.cjs writes it.
const fs = require("node:fs");
const path = require("node:path");

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

/** The shared library's copies that no hook of their plugin requires. */
function unusedLibraryCopies(root) {
  return copiesUnder(root).filter((copy) => !requiresLibrary(path.join(root, path.dirname(path.dirname(path.dirname(copy)))), LIBRARY));
}

module.exports = (ctx) => {
  const root = path.resolve(path.dirname(ctx.abs), "..");
  const found = [];
  const say = (fix, copy) => found.push({ file: path.relative(ctx.root, path.join(root, copy)), line: 1, offending: copy, fix });
  for (const copy of unusedLibraryCopies(root)) say(`is required by no hook, delete it`, copy);
  return found;
};
module.exports.copiesUnder = copiesUnder;
module.exports.unusedLibraryCopies = unusedLibraryCopies;
