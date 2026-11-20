"use strict";
// Across phases in order: a file marked modify or delete exists on disk (from the cwd, the project root) or was created earlier.
const fs = require("node:fs");
const path = require("node:path");
const { phaseRows, section } = require("./plan-model.cjs");

const MARK = /✅|✏|❌/u;
const LINE = /^([\s│├└─|]*)(\S+)/u;

module.exports = (ctx) => {
  const found = [];
  let created = [];
  let deleted = [];
  const { listed } = phaseRows(ctx);
  for (let n = 1; n <= listed; n += 1) {
    const file = `phase-${n}.md`;
    if (!fs.existsSync(path.join(ctx.root, file))) continue;
    const phase = ctx.view(file);
    const s = section(phase, "Architecture projection");
    const block = (s?.body.join("\n").match(/```[^\n]*\n([\s\S]*?)```/u) ?? [, ""])[1];
    let folders = [];
    const made = [];
    const gone = [];
    for (const raw of block.split("\n")) {
      const mark = (raw.match(MARK) ?? [""])[0];
      const m = raw.replace(/[✅✏❌️]/gu, " ").match(LINE);
      if (!m || m[2] === "." || !/^[\w@./-]+$/u.test(m[2])) continue;
      const [, indent, name] = m;
      const parents = folders.filter((f) => f.indent < indent.length);
      const rel = [...parents.map((f) => f.name), name].join("/").replace(/\/+/gu, "/");
      folders = name.endsWith("/") ? [...parents, { indent: indent.length, name: name.replace(/\/$/u, "") }] : parents;
      const present = (fs.existsSync(path.resolve(rel)) || created.includes(rel)) && !deleted.includes(rel);
      if ((mark === "✏" || mark === "❌") && !present) {
        found.push({ file, line: s.line, offending: rel, fix: `${rel} is marked ${mark === "✏" ? "modify" : "delete"} but does not exist` });
      }
      if (mark === "✅") made.push(rel);
      if (mark === "❌") gone.push(rel);
    }
    created = [...created, ...made];
    deleted = [...deleted.filter((d) => !made.includes(d)), ...gone];
  }
  return found;
};
