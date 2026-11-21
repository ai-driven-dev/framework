"use strict";
// Every line of a section is a `- ` item; an empty section says `- None`, and `- None` stands alone.
const { report, NONE } = require("./report-model.cjs");

module.exports = (ctx) =>
  report(ctx).rounds.flatMap((round) => [
    ...round.stray.map((at) => ({ line: at.line, offending: at.text, fix: "write only the aim before the first section" })),
    ...round.sections.flatMap((s) => {
      const found = (s.stray ?? []).map((at) => ({ line: at.line, offending: at.text, fix: `write "${s.name}" as \`- \` items` }));
      if (!s.items.length) found.push({ line: s.line, offending: `# ${s.name}`, fix: `write \`${NONE}\` under an empty "${s.name}"` });
      else if (s.items.length > 1 && s.items.some((item) => item.text.trim() === NONE)) found.push({ line: s.line, offending: `# ${s.name}`, fix: `keep \`${NONE}\` alone in "${s.name}"` });
      return found;
    }),
  ]);
