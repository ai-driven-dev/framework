"use strict";
// A section holds only gaps and their quotes, and each gap is one question; a `?` inside a quoted label is not a second question.
const { report } = require("./report-model.cjs");

const QUOTED = /"[^"\n]*"|“[^”\n]*”|«[^»\n]*»/gu;

module.exports = (ctx) => {
  const { gaps, stray } = report(ctx);
  const found = stray.map((at) => ({ line: at.line, offending: at.text, fix: "write only `- question` lines, each followed by its `  > quote` lines" }));
  for (const gap of gaps) if (!/^[^?]*\?\s*$/u.test(ctx.prose[gap.line - 1].replace(QUOTED, "\"\""))) found.push({ line: gap.line, offending: gap.text, fix: "write one question, ending with ?" });
  return found;
};
