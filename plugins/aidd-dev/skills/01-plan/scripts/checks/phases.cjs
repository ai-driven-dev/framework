"use strict";
// The phase table: at least one row, dependencies on earlier phases only, one file per row and no unlisted file.
const fs = require("node:fs");
const path = require("node:path");
const { phaseRows } = require("./plan-model.cjs");

module.exports = (ctx) => {
  const { listed, rows, line } = phaseRows(ctx);
  const found = [];
  if (!listed) found.push({ line, values: {}, fix: "no row in ## Phases" });
  for (const c of rows) {
    const cell = c.at(-1).replace(/`/gu, "");
    const ok = cell === "none" || cell.split(/\s*,\s*/u).every((p) => /^\d+$/u.test(p) && Number(p) < Number(c[0]));
    if (!ok) found.push({ line, offending: cell, values: {}, fix: `phase ${c[0]} "Depends on" must be "none" or earlier phase numbers` });
  }
  for (let n = 1; n <= listed; n += 1) {
    if (!fs.existsSync(path.join(ctx.root, `phase-${n}.md`))) found.push({ file: `phase-${n}.md`, line: 1, values: {}, fix: "listed in plan.md, file missing" });
  }
  for (const name of ctx.files) {
    const m = /^phase-(\d+)\.md$/u.exec(name);
    if (m && Number(m[1]) > listed) found.push({ file: name, line: 1, values: {}, fix: "not listed in plan.md" });
  }
  return found;
};
