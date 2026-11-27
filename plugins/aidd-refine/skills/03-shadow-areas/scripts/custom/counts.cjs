"use strict";
// The front matter counts the open gaps, and the status is clean only when none is open.
const { open } = require("./report-model.cjs");

module.exports = (ctx) => {
  const count = open(ctx).length;
  const status = count === 0 ? "clean" : "open";
  const { fields, fieldLine } = ctx.fm;
  const found = [];
  if (fields.open !== undefined && fields.open !== String(count)) found.push({ line: fieldLine.open, offending: `open: ${fields.open}`, fix: `count the open gaps: ${count}` });
  if (["clean", "open"].includes(fields.status) && fields.status !== status) found.push({ line: fieldLine.status, offending: `status: ${fields.status}`, fix: `set status: ${status}` });
  return found;
};
