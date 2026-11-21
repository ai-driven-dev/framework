"use strict";
// The skill's memory-rules.md table lists every rule of the memory engine with its severity and its limit, and no other. Anchor: the skill's references/memory-rules.md.
const path = require("node:path");

const NONE = "none";
const ROW = /^\|\s*(M\d+)\s*\|\s*(error|warning)\s*\|\s*([^|]*?)\s*\|/u;

module.exports = (ctx) => {
  const { RULES, LIMITS } = require(path.join(ctx.root, "scripts/lib/memory-rules.cjs"));
  const rows = ctx.lines.flatMap((line, index) => {
    const match = ROW.exec(line);
    return match ? [{ id: match[1], severity: match[2], limit: match[3], line: index + 1 }] : [];
  });
  const found = [];
  for (const { id, severity } of RULES) {
    const row = rows.find((candidate) => candidate.id === id);
    const limit = LIMITS[id] === undefined ? NONE : `${LIMITS[id]} words`;
    if (!row) found.push({ line: 1, offending: id, fix: `${id} is in the engine and missing from the table, add its row` });
    else if (row.severity !== severity) found.push({ line: row.line, offending: id, fix: `${id} is ${severity} in the engine, write ${severity}` });
    else if (row.limit !== limit) found.push({ line: row.line, offending: id, fix: `${id} has the limit ${limit} in the engine, write it` });
  }
  for (const row of rows) if (!RULES.some(({ id }) => id === row.id)) found.push({ line: row.line, offending: row.id, fix: `${row.id} is not a rule of the engine, delete the row` });
  return found;
};
