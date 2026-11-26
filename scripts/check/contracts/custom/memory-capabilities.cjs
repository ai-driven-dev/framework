"use strict";
// The skill's capabilities.md names in its File column exactly the templates of assets/templates/memory. Anchor: references/capabilities.md.
const fs = require("node:fs");
const path = require("node:path");

const TEMPLATES = "assets/templates/memory";
const cells = (line) => line.replace(/^\||\|$/gu, "").split("|").map((cell) => cell.trim());

module.exports = (ctx) => {
  const rows = ctx.lines.map((line, index) => ({ line: index + 1, text: line })).filter(({ text }) => text.startsWith("|"));
  const header = rows.length ? cells(rows[0].text) : [];
  const column = header.indexOf("File");
  if (column < 0) return [{ line: rows[0]?.line ?? 1, fix: "the first table has no File column, name each template file in it" }];
  const named = rows.slice(1).filter(({ text }) => !/^\|[\s|:-]+\|$/u.test(text)).flatMap(({ line, text }) => (cells(text)[column]?.match(/[\w-]+\.md/gu) ?? []).map((file) => ({ file, line })));
  const dir = path.join(ctx.root, TEMPLATES);
  const present = fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith(".md")) : [];
  return [
    ...named.filter(({ file }) => !present.includes(file)).map(({ file, line }) => ({ line, offending: file, fix: `${file} has no template under ${TEMPLATES}, add it or drop the name` })),
    ...present.filter((file) => !named.some((row) => row.file === file)).map((file) => ({ line: 1, offending: file, fix: `${file} belongs to no row, name it in the File column` })),
  ];
};
