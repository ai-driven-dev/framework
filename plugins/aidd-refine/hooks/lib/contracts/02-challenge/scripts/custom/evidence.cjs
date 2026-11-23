"use strict";
// A deal breaker names its evidence.
const { findingsOf } = require("./report-model.cjs");

module.exports = (ctx) =>
  findingsOf(ctx, "Deal breakers")
    .filter((item) => !/\bevidence\b/iu.test(item.text))
    .map((item) => ({ line: item.line, offending: item.text, fix: "name the evidence: the command and its output, or where it shows" }));
