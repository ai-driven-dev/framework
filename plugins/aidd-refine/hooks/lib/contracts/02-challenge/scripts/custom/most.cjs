"use strict";
// To decide and Suggestions keep three items at most per round.
const { report, NONE } = require("./report-model.cjs");

const MOST = { "To decide": 3, Suggestions: 3 };

module.exports = (ctx) =>
  report(ctx).rounds.flatMap((round) =>
    round.sections
      .filter((s) => s.name in MOST && s.items.filter((item) => item.text.trim() !== NONE).length > MOST[s.name])
      .map((s) => ({ line: s.items[MOST[s.name]].line, offending: s.items[MOST[s.name]].text, fix: `keep ${MOST[s.name]} items at most in "${s.name}", the ones that change a decision` })),
  );
