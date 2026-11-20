"use strict";
// Every external source row names a URL, or the table says none.
const { section } = require("./plan-model.cjs");

module.exports = (ctx) => {
  const s = section(ctx, "External sources");
  if (!s) return [];
  return s.body
    .filter((l) => l.startsWith("|") && !/^\|[\s:|-]+\|$/u.test(l) && !/^\|\s*URL\b/u.test(l) && !/^\|\s*`?none/iu.test(l) && !l.includes("http"))
    .map((l) => ({ line: s.line, offending: l, fix: `External sources row without a URL: ${l.slice(0, 40)}` }));
};
