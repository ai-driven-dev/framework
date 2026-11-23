"use strict";
// Only the aim stands outside a section, every line of a section is a `- ` item, and `- None` stands alone.
const { report, NONE } = require("./report-model.cjs");

module.exports = (ctx) => {
  const { sections, stray } = report(ctx);
  return [
    ...stray.map((at) => ({ line: at.line, offending: at.text, fix: "write only the aim before the first section" })),
    ...sections.flatMap((s) => [
      ...s.stray.map((at) => ({ line: at.line, offending: at.text, fix: `write "${s.name}" as \`- \` items` })),
      ...(s.items.length > 1 && s.items.some((item) => item.text.trim() === NONE) ? [{ line: s.line, offending: `### ${s.name}`, fix: `keep \`${NONE}\` alone in "${s.name}"` }] : []),
    ]),
  ];
};
