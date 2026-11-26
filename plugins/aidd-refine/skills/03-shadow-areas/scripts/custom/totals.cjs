"use strict";
// The header totals equal the gaps counted: all but the closed ones, overall and per severity.
const { inScope, locked } = require("./report-model.cjs");

const TOTALS = /^Total gaps: (\d+) \| Blocker: (\d+) \| Major: (\d+) \| Minor: (\d+)\s*$/u;

module.exports = (ctx) => {
  const index = ctx.prose.findIndex((line) => line.startsWith("Total gaps:"));
  const match = index < 0 ? null : TOTALS.exec(ctx.prose[index]);
  const gaps = inScope(ctx);
  const count = (severity) => gaps.filter((gap) => gap.severity === severity).length;
  const expected = [gaps.length, ...locked(ctx).severities.map(count)];
  const line = `Total gaps: ${expected[0]} | Blocker: ${expected[1]} | Major: ${expected[2]} | Minor: ${expected[3]}`;
  if (!match) return [{ line: index < 0 ? 1 : index + 1, offending: index < 0 ? undefined : ctx.lines[index], fix: `write the totals line "${line}"` }];
  return match.slice(1).map(Number).every((value, i) => value === expected[i]) ? [] : [{ line: index + 1, offending: ctx.lines[index], fix: `count every gap but the closed ones: "${line}"` }];
};
