"use strict";
// Across phases in order: a file marked modify or delete exists on disk (from the cwd, the project root) or was created earlier.
const fs = require("node:fs");
const path = require("node:path");
const { phaseRows, section } = require("./plan-model.cjs");

const MARK = /✅|✏|❌/u;
// A name is words joined by single spaces: a run of two or more spaces starts an annotation.
// Limit: a single-spaced note made only of path characters ("composition wiring") reads as part of the name.
const LINE = /^([\s│├└─|]*)(\S+(?: \S+)*)/u;
const PATH = /^[\w@./ -]+$/u;

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
      if (!m) continue;
      // A single-spaced note after the name ("a.js (note)") makes the whole run no path: read the first word, as before spaces were allowed.
      const name = PATH.test(m[2]) ? m[2] : m[2].split(" ")[0];
      if (name === "." || !PATH.test(name)) continue;
      const indent = m[1];
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
