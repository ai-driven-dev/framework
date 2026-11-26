"use strict";
// No two open gaps ask the same question.
const { open, flat } = require("./report-model.cjs");

module.exports = (ctx) => {
  const seen = new Map();
  const found = [];
  for (const gap of open(ctx)) {
    const key = flat(gap.question).toLowerCase();
    if (seen.has(key)) found.push({ line: gap.line, offending: gap.text, fix: `merge it with the gap on line ${seen.get(key)}` });
    else seen.set(key, gap.line);
  }
  return found;
};
