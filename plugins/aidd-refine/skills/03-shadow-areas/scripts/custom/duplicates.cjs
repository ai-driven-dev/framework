"use strict";
// No two open gaps ask the same question, or quote the same passage under one category.
const { open, flat } = require("./report-model.cjs");

module.exports = (ctx) => {
  const seen = new Map();
  const found = [];
  for (const gap of open(ctx)) {
    const keys = [`?${flat(gap.question).toLowerCase()}`, ...gap.quotes.map((q) => `${gap.category}>${flat(q.text)}`)];
    const first = keys.map((key) => seen.get(key)).find(Boolean);
    if (first) found.push({ line: gap.line, offending: gap.text, fix: `merge it with the gap on line ${first}` });
    for (const key of keys) if (!seen.has(key)) seen.set(key, gap.line);
  }
  return found;
};
