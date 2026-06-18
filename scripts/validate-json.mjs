#!/usr/bin/env node
// Local JSON validator for framework files. It always checks JSON syntax and
// applies repository-specific structural checks for Claude plugin metadata.

import { access, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const INPUTS = process.argv.slice(2).filter((file) => file !== "--");
const errors = [];

function fail(file, message) {
  errors.push(`${file}: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireString(file, object, key) {
  if (typeof object[key] !== "string" || object[key].trim() === "") {
    fail(file, `missing or invalid string field '${key}'`);
  }
}

function requireStringArray(file, object, key) {
  if (!Array.isArray(object[key]) || object[key].some((value) => typeof value !== "string" || value.trim() === "")) {
    fail(file, `missing or invalid string array '${key}'`);
  }
}

async function pathExists(file, relativePath, label, baseDir = path.dirname(path.join(ROOT, file))) {
  try {
    await access(path.resolve(baseDir, relativePath));
  } catch {
    fail(file, `${label} does not exist: ${relativePath}`);
  }
}

async function validatePluginManifest(file, data) {
  for (const key of ["name", "version", "description", "repository", "homepage", "license"]) {
    requireString(file, data, key);
  }
  if (!isObject(data.author)) {
    fail(file, "missing or invalid object field 'author'");
  } else {
    requireString(file, data.author, "name");
  }
  requireStringArray(file, data, "skills");
  const pluginRoot = path.dirname(path.dirname(path.join(ROOT, file)));
  for (const skillPath of data.skills ?? []) {
    await pathExists(file, skillPath, "skill path", pluginRoot);
  }
  if (data.agents !== undefined) {
    requireStringArray(file, data, "agents");
    for (const agentPath of data.agents ?? []) {
      await pathExists(file, agentPath, "agent path", pluginRoot);
    }
  }
  if (data.keywords !== undefined) {
    requireStringArray(file, data, "keywords");
  }
}

async function validateMarketplace(file, data) {
  for (const key of ["name", "version", "description"]) {
    requireString(file, data, key);
  }
  if (!isObject(data.owner)) {
    fail(file, "missing or invalid object field 'owner'");
  } else {
    requireString(file, data.owner, "name");
  }
  if (!Array.isArray(data.plugins) || data.plugins.length === 0) {
    fail(file, "missing or invalid non-empty array 'plugins'");
    return;
  }
  const names = new Set();
  for (const [index, plugin] of data.plugins.entries()) {
    const label = `plugins[${index}]`;
    if (!isObject(plugin)) {
      fail(file, `${label} must be an object`);
      continue;
    }
    for (const key of ["name", "version", "source", "description"]) {
      if (typeof plugin[key] !== "string" || plugin[key].trim() === "") {
        fail(file, `${label}.${key} must be a non-empty string`);
      }
    }
    if (names.has(plugin.name)) fail(file, `duplicate plugin name: ${plugin.name}`);
    names.add(plugin.name);
    if (typeof plugin.strict !== "boolean") fail(file, `${label}.strict must be boolean`);
    if (typeof plugin.recommended !== "boolean") fail(file, `${label}.recommended must be boolean`);
    if (typeof plugin.source === "string") await pathExists(file, plugin.source, `${label}.source`, ROOT);
  }
}

function validateClaudeSettings(file, data) {
  if (data.extraKnownMarketplaces !== undefined && !isObject(data.extraKnownMarketplaces)) {
    fail(file, "extraKnownMarketplaces must be an object when present");
  }
  if (data.enabledPlugins !== undefined) {
    if (!isObject(data.enabledPlugins)) {
      fail(file, "enabledPlugins must be an object when present");
    } else {
      for (const [name, enabled] of Object.entries(data.enabledPlugins)) {
        if (typeof enabled !== "boolean") fail(file, `enabledPlugins.${name} must be boolean`);
      }
    }
  }
}

async function validate(file) {
  let data;
  try {
    data = JSON.parse(await readFile(path.join(ROOT, file), "utf8"));
  } catch (error) {
    fail(file, `invalid JSON (${error.message})`);
    return;
  }

  if (file.endsWith(".claude-plugin/plugin.json") || file.includes("/.claude-plugin/plugin.json")) {
    await validatePluginManifest(file, data);
  } else if (file.endsWith(".claude-plugin/marketplace.json") || file.includes("/.claude-plugin/marketplace.json")) {
    await validateMarketplace(file, data);
  } else if (file.endsWith(".claude/settings.json") || file.endsWith(".claude/settings.local.json") || file.includes("/.claude/settings.")) {
    validateClaudeSettings(file, data);
  }
}

for (const file of INPUTS) {
  await validate(file);
}

if (errors.length > 0) {
  console.error(errors.map((error) => `❌ ${error}`).join("\n"));
  process.exit(1);
}

console.log(`JSON validation passed for ${INPUTS.length} file(s).`);
