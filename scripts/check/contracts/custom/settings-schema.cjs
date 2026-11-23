"use strict";
// Every tracked Claude settings file conforms to the official schema stored in schemas/official. Anchor: marketplace.json.
const fs = require("node:fs");
const path = require("node:path");
const { validateJson } = require("../../engine/ops.cjs");
const { trackedFiles } = require("./no-local-paths.cjs");

const SCHEMA = path.resolve(__dirname, "../schemas/official/claude-code-settings.json");
// Synthetic mock trees, never the repository's own settings.
const EXCLUDED = ["cli/tests/fixtures/"];
const isSettings = (file) => file.endsWith(".claude/settings.json") || file.endsWith(".claude/settings.local.json");

module.exports = (ctx) => {
  const root = path.resolve(path.dirname(ctx.abs), "..");
  const found = [];
  for (const file of trackedFiles(root).filter((f) => isSettings(f) && !EXCLUDED.some((dir) => f.startsWith(dir)))) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
    } catch {
      continue; // unreadable or unparsable: REPO-05 says so
    }
    for (const problem of validateJson(data, SCHEMA)) found.push({ file: path.relative(ctx.root, path.join(root, file)), line: 1, offending: problem.at, fix: problem.say });
  }
  return found;
};
