"use strict";
// A locked spec has resolved every open question: its Open Questions section holds only `None`.
const { sectionOf } = require("../lib/markdown.cjs");

module.exports = function lockedClosed(ctx) {
  if ((ctx.fm.fields.status ?? "").replace(/^["']|["']$/gu, "") !== "locked") return [];
  const section = sectionOf(ctx.prose);
  return ctx.prose
    .map((line, index) => ({ line: index + 1, text: line.trim(), section: section[index] }))
    .filter(({ text, section }) => section === "Open Questions" && text && text !== "None" && !text.startsWith("## "))
    .map(({ line }) => ({ line, offending: ctx.lines[line - 1] }));
};
