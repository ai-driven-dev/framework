"use strict";
// Every plugin the marketplace lists has a build-plugin matrix entry in the CI and a release-please package. Anchor: .claude-plugin/marketplace.json.
const fs = require("node:fs");
const path = require("node:path");

/** The names of `plugin:` under the build-plugin job's matrix, flow or block list, comments dropped. */
function matrix(workflow) {
  const lines = workflow.split("\n");
  const job = lines.findIndex((l) => /^ {2}build-plugin:/u.test(l));
  if (job < 0) return [];
  const end = lines.findIndex((l, i) => i > job && /^ {2}\S/u.test(l));
  const body = lines.slice(job, end < 0 ? undefined : end).map((l) => l.replace(/#.*$/u, "")).join("\n");
  const flow = /^\s+plugin:\s*\[([^\]]*)\]/mu.exec(body)?.[1];
  if (flow !== undefined) return flow.split(",").map((n) => n.trim()).filter(Boolean);
  const block = /^(\s+)plugin:\s*\n((?:\1\s+- .*\n?)+)/mu.exec(body)?.[2] ?? "";
  return block.split("\n").map((l) => l.replace(/^\s*- /u, "").trim()).filter(Boolean);
}

module.exports = (ctx) => {
  const root = path.resolve(path.dirname(ctx.abs), "..");
  const listed = JSON.parse(ctx.text).plugins.map((p) => p.name).sort();
  const built = matrix(fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8")).sort();
  const config = JSON.parse(fs.readFileSync(path.join(root, "release-please-config.json"), "utf8"));
  const versioned = Object.keys(config.packages).filter((p) => p.startsWith("plugins/")).map((p) => p.slice("plugins/".length)).sort();
  const found = [];
  const compare = (names, where) => {
    for (const name of listed) if (!names.includes(name)) found.push({ line: 1, offending: name, fix: `${name} is listed in the marketplace but not in ${where}` });
    for (const name of names) if (!listed.includes(name)) found.push({ line: 1, offending: name, fix: `${name} is in ${where} but not listed in the marketplace` });
  };
  compare(built, "the build-plugin matrix of ci.yml");
  compare(versioned, "the packages of release-please-config.json");
  return found;
};
