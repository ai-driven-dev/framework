"use strict";
// The file opens on `# Round 1`, and each later round is numbered one above the last.
const { report } = require("./report-model.cjs");

module.exports = (ctx) => {
  const { before, rounds } = report(ctx);
  const found = before.slice(0, 1).map((at) => ({ line: at.line, offending: at.text, fix: "write nothing before `# Round 1`" }));
  if (!rounds.length) found.push({ line: 1, fix: "write the report under a `# Round 1` heading" });
  rounds.forEach((round, index) => {
    if (round.number !== index + 1) found.push({ line: round.line, offending: `# Round ${round.number}`, fix: `number this round ${index + 1}` });
  });
  return found;
};
