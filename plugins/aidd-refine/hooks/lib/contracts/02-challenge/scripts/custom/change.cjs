"use strict";
// A deal breaker, a To decide and a suggestion each name, after `→`, what to change or ask.
const { findingsOf } = require("./report-model.cjs");

module.exports = (ctx) =>
  ["Deal breakers", "To decide", "Suggestions"]
    .flatMap((name) => findingsOf(ctx, name))
    .filter(({ item }) => !item.text.includes("→"))
    .map(({ item }) => ({ line: item.line, offending: item.text, fix: "name after `→` the change or the question" }));
