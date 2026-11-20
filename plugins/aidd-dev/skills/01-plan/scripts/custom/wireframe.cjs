"use strict";
// A kept wireframe has a region (1) and its legend "1. ...".
const { section } = require("./plan-model.cjs");

module.exports = (ctx) => {
  const s = section(ctx, "Wireframe");
  if (!s) return [];
  const body = s.body.join("\n");
  return /\(1\)/u.test(body) && /^1\. /mu.test(body) ? [] : [{ line: s.line, fix: 'section "Wireframe" needs a frame with region (1) and a legend "1. ...", or omit the section' }];
};
