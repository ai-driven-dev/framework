"use strict";
// A To decide ends on the question for whoever owns the request.
const { findingsOf } = require("./report-model.cjs");

module.exports = (ctx) =>
  findingsOf(ctx, "To decide")
    .filter(({ item }) => !item.text.trimEnd().endsWith("?"))
    .map(({ item }) => ({ line: item.line, offending: item.text, fix: "end with the question for whoever owns the request" }));
