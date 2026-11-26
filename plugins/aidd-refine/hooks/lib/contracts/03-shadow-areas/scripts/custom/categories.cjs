"use strict";
// Every category heading is a locked category, each at most once, in the locked order.
const { report, locked } = require("./report-model.cjs");

module.exports = (ctx) => {
  const order = locked(ctx).categories;
  let previous = -1;
  return report(ctx).categories.flatMap((category) => {
    const rank = order.indexOf(category.name);
    if (rank < 0) return [{ line: category.line, offending: `### ${category.name}`, fix: `use one of: ${order.join(", ")}` }];
    if (rank <= previous) return [{ line: category.line, offending: `### ${category.name}`, fix: `write each category once, in this order: ${order.join(", ")}` }];
    previous = rank;
    return [];
  });
};
