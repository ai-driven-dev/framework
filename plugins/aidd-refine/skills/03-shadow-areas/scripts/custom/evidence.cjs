"use strict";
// Each open gap quotes the source verbatim, a contradiction both sides; the source is a file next to the report.
const fs = require("node:fs");
const path = require("node:path");
const { open, flat } = require("./report-model.cjs");

module.exports = (ctx) => {
  const name = ctx.fm.fields.source;
  if (!name) return [];
  const line = ctx.fm.fieldLine.source;
  if (/[\\/]/u.test(name)) return [{ line, offending: `source: ${name}`, fix: "write the source's file name only, the report sits next to it" }];
  let source;
  try {
    source = flat(fs.readFileSync(path.join(ctx.root, name), "utf8"));
  } catch {
    return [{ line, offending: `source: ${name}`, fix: `${name} is not next to the report: name the file the report scans` }];
  }
  return open(ctx).flatMap((gap) => {
    const needed = gap.category === "contradiction" ? 2 : 1;
    const found = gap.quotes.length < needed ? [{ line: gap.line, offending: gap.text, fix: needed === 2 ? "quote both statements that conflict" : "quote the source passage the gap comes from" }] : [];
    for (const quote of gap.quotes) if (!source.includes(flat(quote.text))) found.push({ line: quote.line, offending: quote.text, fix: `quote ${name} verbatim, this text is not in it` });
    return found;
  });
};
