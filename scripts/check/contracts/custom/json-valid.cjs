"use strict";
// Every tracked JSON file parses, and the marketplace holds the fields and paths the host reads. Plugin manifests are PLUGIN-01's. Anchor: marketplace.json.
// The project's own requirements only. Types and shapes are the official schemas' (PLUGIN-03, REPO-09, REPO-10): no field is checked twice.
const fs = require("node:fs");
const path = require("node:path");
const { trackedFiles } = require("./no-local-paths.cjs");

// Synthetic mock trees, never the repository's own JSON.
const EXCLUDED = ["cli/tests/fixtures/"];

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const blank = (value) => typeof value !== "string" || value.trim() === "";

function kindOf(file) {
  if (file.endsWith(".claude-plugin/marketplace.json")) return "marketplace";
  return null;
}

/** Problems of one parsed file, as messages. */
function problemsOf(root, file, data) {
  const out = [];
  const fail = (message) => out.push(message);
  const string = (object, key) => blank(object[key]) && fail(`missing or invalid string field '${key}'`);
  const exists = (rel, label, base) => fs.existsSync(path.resolve(base, rel)) || fail(`${label} does not exist: ${rel}`);
  const kind = kindOf(file);
  if (kind === "marketplace") {
    for (const key of ["version", "description"]) string(data, key);
    if (!Array.isArray(data.plugins) || data.plugins.length === 0) {
      fail("missing or invalid non-empty array 'plugins'");
      return out;
    }
    const names = new Set();
    for (const [index, plugin] of data.plugins.entries()) {
      const label = `plugins[${index}]`;
      if (!isObject(plugin)) {
        fail(`${label} must be an object`);
        continue;
      }
      // A plugin's version is release-please's, stamped at release time, never in the manifest.
      if (blank(plugin.description)) fail(`${label}.description must be a non-empty string`);
      if (names.has(plugin.name)) fail(`duplicate plugin name: ${plugin.name}`);
      names.add(plugin.name);
      if (typeof plugin.metadata?.recommended !== "boolean") fail(`${label}.metadata.recommended must be boolean`);
      if (typeof plugin.source === "string") exists(plugin.source, `${label}.source`, root);
    }
  }
  return out;
}

function jsonProblems(root, files) {
  const found = [];
  for (const file of files) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") continue;
      found.push({ file, message: `invalid JSON (${error.message})` });
      continue;
    }
    for (const message of problemsOf(root, file, data)) found.push({ file, message });
  }
  return found;
}

module.exports = (ctx) => {
  const root = path.resolve(path.dirname(ctx.abs), "..");
  const files = trackedFiles(root).filter((f) => f.endsWith(".json") && !EXCLUDED.some((dir) => f.startsWith(dir)));
  return jsonProblems(root, files).map(({ file, message }) => ({ file: path.relative(ctx.root, path.join(root, file)), line: 1, offending: file, fix: message }));
};
module.exports.problemsOf = problemsOf;
module.exports.jsonProblems = jsonProblems;
