"use strict";
// The aidd-dev skills share one severity scale: critical, major, minor. Anchor: .claude-plugin/marketplace.json.
const fs = require("node:fs");
const path = require("node:path");

const SKILLS = "plugins/aidd-dev/skills";

function markdown(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((e) => (e.isDirectory() ? markdown(path.join(dir, e.name)) : e.name.endsWith(".md") ? [path.join(dir, e.name)] : []));
}

module.exports = (ctx) => {
  const root = path.resolve(path.dirname(ctx.abs), "..");
  const read = (rel) => fs.readFileSync(path.join(root, SKILLS, rel), "utf8");
  const found = [];
  const say = (file, offending, fix) => found.push({ line: 1, offending: `${file}`, fix: `${file}: ${fix}`, values: {} });
  for (const file of markdown(path.join(root, SKILLS))) {
    const rel = path.relative(path.join(root, SKILLS), file).split(path.sep).join("/");
    if (/\bwarning\b/iu.test(fs.readFileSync(file, "utf8"))) say(rel, rel, "names a severity the scale does not have, use critical, major or minor");
  }
  const audit = read("04-audit/assets/audit-template.md");
  if (!/\{\{n_critical\}\} critical, \{\{n_major\}\} major, \{\{n_minor\}\} minor/u.test(audit)) say("04-audit/assets/audit-template.md", "count", "count findings as critical, major, minor");
  if (!/^- 🟡 major - /mu.test(audit)) say("04-audit/assets/audit-template.md", "major", "define the major level as `- 🟡 major - `");
  if (!/🔴 critical, 🟡 major, 🟢 minor/u.test(read("07-refactor/SKILL.md"))) say("07-refactor/SKILL.md", "scale", "read an audit's findings as 🔴 critical, 🟡 major, 🟢 minor");
  return found;
};
