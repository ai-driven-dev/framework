"use strict";
// Hosts resolve an agent by its file: `<name>.md`, Copilot's `<name>.agent.md`, Antigravity's `<name>/agent.md`. OpenCode and Kilo keep no name field.
const path = require("node:path");

module.exports = function name(ctx) {
  const abs = ctx.abs.split(path.sep).join("/");
  if (/\/\.(?:opencode|kilo)\/agents\/[^/]+$/u.test(abs)) return [];
  const file = path.basename(abs);
  const expected = file === "agent.md" ? path.basename(path.dirname(abs)) : file.replace(/(?:\.agent)?\.md$/u, "");
  const value = (ctx.fm.fields.name ?? "").replace(/^["']|["']$/gu, "");
  return value === expected ? [] : [{ line: ctx.fm.fieldLine.name ?? 1, offending: value, fix: `set name to ${expected}` }];
};
