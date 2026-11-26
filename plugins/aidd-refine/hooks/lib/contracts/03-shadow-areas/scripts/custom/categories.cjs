"use strict";
// Each section is a category with gaps, once, in report order, and Closed comes last.
const { CATEGORIES, CLOSED, report } = require("./report-model.cjs");

module.exports = (ctx) => {
  const { sections, gaps } = report(ctx);
  let previous = -1;
  return sections.flatMap((section) => {
    const offending = `## ${section.name}`;
    const rank = section.name === CLOSED ? CATEGORIES.length : CATEGORIES.indexOf(section.name);
    if (rank < 0) return [{ line: section.line, offending, fix: `use a category of: ${CATEGORIES.join(", ")}` }];
    if (rank <= previous) return [{ line: section.line, offending, fix: `write each category once, in this order: ${CATEGORIES.join(", ")}, then Closed` }];
    previous = rank;
    if (!gaps.some((gap) => gap.category === section.name)) return [{ line: section.line, offending, fix: "omit a section without gaps" }];
    return [];
  });
};
