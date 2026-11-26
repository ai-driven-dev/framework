"use strict";
// Each line of Open Questions is one gap, written `- TBD: <question>`, so a reader finds every gap by one marker.
const { sectionOf } = require("../lib/markdown.cjs");

const GAP = /^- TBD: \S/u;

module.exports = function gapForm(ctx) {
  const section = sectionOf(ctx.prose);
  return ctx.prose
    .map((line, index) => ({ line: index + 1, text: line.trim(), section: section[index] }))
    .filter(({ text, section }) => section === "Open Questions" && text && !text.startsWith("## ") && !GAP.test(text))
    .map(({ line }) => ({ line, offending: ctx.lines[line - 1] }));
};
