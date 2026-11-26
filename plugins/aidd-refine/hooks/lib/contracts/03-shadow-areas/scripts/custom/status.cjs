"use strict";
// `status: clean` stands exactly when no blocker and no major is counted.
const { inScope } = require("./report-model.cjs");

module.exports = (ctx) => {
  const clean = !inScope(ctx).some((gap) => gap.severity === "blocker" || gap.severity === "major");
  const stamped = "status" in ctx.fm.fields;
  if (clean && !stamped) return [{ line: 1, fix: "add `status: clean` to the front matter: no blocker or major is counted" }];
  if (!clean && stamped) return [{ line: ctx.fm.fieldLine.status, offending: `status: ${ctx.fm.fields.status}`, fix: "remove `status` from the front matter: a blocker or major is counted" }];
  return [];
};
