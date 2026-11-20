"use strict";
// Tasks numbered 1..n without a gap; every acceptance row maps to a task.
const { section } = require("./plan-model.cjs");

module.exports = (ctx) => {
  const tasks = new Set([...ctx.text.matchAll(/^###\s*`?(\d+)\)/gmu)].map((m) => m[1]));
  const numbers = [...tasks].map(Number).sort((a, b) => a - b);
  const found = [];
  if (numbers.some((n, i) => n !== i + 1)) found.push({ line: 1, fix: `task numbers must run 1 to ${numbers.length} with no gap` });
  const s = section(ctx, "Test acceptance criteria");
  for (const m of (s?.body.join("\n") ?? "").matchAll(/^\|\s*(\d+)\s*\|/gmu)) {
    if (!tasks.has(m[1])) found.push({ line: s.line, fix: `acceptance row ${m[1]} maps to no task` });
  }
  return found;
};
