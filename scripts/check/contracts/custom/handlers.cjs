"use strict";
// Every command names a handler that exists and parses.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const HANDLER = /\$\{CLAUDE_PLUGIN_ROOT\}\/(\S+\.cjs)/u;

module.exports = (ctx) => {
  let config;
  try {
    config = JSON.parse(ctx.text);
  } catch {
    return [];
  }
  const found = [];
  const hooks = Object.values(config.hooks ?? {}).flatMap((groups) => (Array.isArray(groups) ? groups : [])).flatMap((group) => group.hooks ?? []);
  for (const hook of hooks) {
    const rel = HANDLER.exec(hook.command ?? "")?.[1];
    if (!rel) continue;
    const line = ctx.lines.findIndex((l) => l.includes(rel)) + 1 || 1;
    const file = path.resolve(path.dirname(ctx.abs), "..", rel);
    if (!fs.existsSync(file)) {
      found.push({ line, offending: rel, fix: `${rel} does not exist` });
      continue;
    }
    try {
      execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
    } catch {
      found.push({ line, offending: rel, fix: `${rel} does not parse` });
    }
  }
  return found;
};
