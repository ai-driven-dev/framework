"use strict";
// Every tracked JSON file parses, and the plugin manifests, the marketplace and Claude settings hold the fields and paths the host reads. Anchor: marketplace.json.
// The local checks only: no network. The published schemas at schemastore.org stay with scripts/validate-json.mjs.
const fs = require("node:fs");
const path = require("node:path");
const { trackedFiles } = require("./no-local-paths.cjs");

// Synthetic mock trees, never the repository's own JSON.
const EXCLUDED = ["cli/tests/fixtures/"];

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const blank = (value) => typeof value !== "string" || value.trim() === "";

function kindOf(file) {
  if (file.endsWith(".claude-plugin/plugin.json")) return "plugin";
  if (file.endsWith(".claude-plugin/marketplace.json")) return "marketplace";
  if (file.endsWith(".claude/settings.json") || file.endsWith(".claude/settings.local.json") || file.includes("/.claude/settings.")) return "settings";
  return null;
}

/** Problems of one parsed file, as messages. */
function problemsOf(root, file, data) {
  const out = [];
  const fail = (message) => out.push(message);
  const string = (object, key) => blank(object[key]) && fail(`missing or invalid string field '${key}'`);
  const strings = (object, key) => (!Array.isArray(object[key]) || object[key].some(blank)) && fail(`missing or invalid string array '${key}'`);
  const exists = (rel, label, base) => fs.existsSync(path.resolve(base, rel)) || fail(`${label} does not exist: ${rel}`);
  const kind = kindOf(file);
  if (kind === "plugin") {
    for (const key of ["name", "version", "description", "repository", "homepage", "license"]) string(data, key);
    if (!isObject(data.author)) fail("missing or invalid object field 'author'");
    else string(data.author, "name");
    const pluginRoot = path.dirname(path.dirname(path.join(root, file)));
    // Absent means the host's default `./skills`, so only a declared list is checked.
    for (const key of ["skills", "agents"]) {
      if (data[key] === undefined) continue;
      strings(data, key);
      for (const rel of data[key] ?? []) exists(rel, `${key === "skills" ? "skill" : "agent"} path`, pluginRoot);
    }
    if (data.keywords !== undefined) strings(data, "keywords");
  } else if (kind === "marketplace") {
    for (const key of ["name", "version", "description"]) string(data, key);
    if (!isObject(data.owner)) fail("missing or invalid object field 'owner'");
    else string(data.owner, "name");
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
      for (const key of ["name", "source", "description"]) if (blank(plugin[key])) fail(`${label}.${key} must be a non-empty string`);
      if (names.has(plugin.name)) fail(`duplicate plugin name: ${plugin.name}`);
      names.add(plugin.name);
      if (typeof plugin.strict !== "boolean") fail(`${label}.strict must be boolean`);
      if (typeof plugin.metadata?.recommended !== "boolean") fail(`${label}.metadata.recommended must be boolean`);
      if (typeof plugin.source === "string") exists(plugin.source, `${label}.source`, root);
    }
  } else if (kind === "settings") {
    if (data.extraKnownMarketplaces !== undefined && !isObject(data.extraKnownMarketplaces)) fail("extraKnownMarketplaces must be an object when present");
    if (data.enabledPlugins === undefined) return out;
    if (!isObject(data.enabledPlugins)) fail("enabledPlugins must be an object when present");
    else for (const [name, enabled] of Object.entries(data.enabledPlugins)) if (typeof enabled !== "boolean") fail(`enabledPlugins.${name} must be boolean`);
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
  return jsonProblems(root, files).map(({ file, message }) => ({ line: 1, offending: file, fix: `${file}: ${message}` }));
};
module.exports.problemsOf = problemsOf;
module.exports.jsonProblems = jsonProblems;
