"use strict";
// Each round's first line is `Aim:` and a one-line aim.
const { report } = require("./report-model.cjs");

module.exports = (ctx) =>
  report(ctx).rounds.flatMap((round) => {
    if (!round.aim) return [{ line: round.line, offending: `# Round ${round.number}`, fix: "open the round with `Aim: <what the work serves>`" }];
    return round.aim.value ? [] : [{ line: round.aim.line, offending: round.aim.text, fix: "state the aim after `Aim:`" }];
  });
