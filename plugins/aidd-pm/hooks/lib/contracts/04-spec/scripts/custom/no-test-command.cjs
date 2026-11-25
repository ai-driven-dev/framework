"use strict";
// Done-when states what holds, never the command that checks it: the plan and the assert step own that.
const { sectionOf } = require("../../../lib/markdown.cjs");

const TEST_COMMAND = /\b(?:npm|pnpm|yarn|bun) (?:run )?test\b|node --test|\b(?:pytest|vitest|jest)\b|\b(?:go|cargo) test\b|\btests? (?:pass|are green|is green)|\bis green\b/iu;

module.exports = function noTestCommand(ctx) {
  const section = sectionOf(ctx.prose);
  return ctx.prose
    .map((_, index) => ({ line: index + 1, text: ctx.lines[index], section: section[index] }))
    .filter(({ text, section }) => section === "Done-when" && TEST_COMMAND.test(text))
    .map(({ line }) => ({ line, offending: ctx.lines[line - 1] }));
};
