"use strict";
// Each round holds the template's four sections, in its order, and no other.
const { report, SECTIONS } = require("./report-model.cjs");

module.exports = (ctx) =>
  report(ctx).rounds.flatMap((round) => {
    const names = round.sections.map((s) => s.name);
    if (names.join("|") === SECTIONS.join("|")) return [];
    return [{ line: round.line, offending: names.map((n) => `# ${n}`).join(", "), fix: `give round ${round.number} the sections ${SECTIONS.join(", ")}, in that order` }];
  });
