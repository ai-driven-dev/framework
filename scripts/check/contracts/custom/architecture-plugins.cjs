"use strict";
// docs/ARCHITECTURE.md holds one row per plugin of plugins/, in its Plugin and Owns table. Anchor: README.md.
// The Owns column is written by hand, so the table cannot be generated: the roster is what is checked.
const fs = require("node:fs");
const path = require("node:path");

const DOC = "docs/ARCHITECTURE.md";
const cells = (line) => line.trim().replace(/^\||\|$/gu, "").split(/(?<!\\)\|/u).map((cell) => cell.trim());

module.exports = (ctx) => {
  const doc = path.join(ctx.root, DOC);
  const plugins = path.join(ctx.root, "plugins");
  if (!fs.existsSync(doc) || !fs.existsSync(plugins)) return [];
  const lines = fs.readFileSync(doc, "utf8").split("\n");
  const head = lines.findIndex((line) => line.trim().startsWith("|") && cells(line).includes("Plugin") && cells(line).includes("Owns"));
  if (head < 0) return [{ file: DOC, line: 1, fix: "add the table with the columns Plugin and Owns, one row per plugin" }];
  const column = cells(lines[head]).indexOf("Plugin");
  const documented = [];
  for (let at = head + 2; at < lines.length && lines[at].trim().startsWith("|"); at += 1) documented.push({ name: /`([^`]+)`/u.exec(cells(lines[at])[column] ?? "")?.[1], line: at + 1 });
  const present = fs.readdirSync(plugins, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  return [
    ...present.filter((name) => !documented.some((row) => row.name === name)).map((name) => ({ file: DOC, line: head + 1, offending: name, fix: `add a row for plugins/${name}` })),
    ...documented.filter((row) => !present.includes(row.name)).map((row) => ({ file: DOC, line: row.line, offending: row.name, fix: `no plugins/${row.name}, delete the row or name the plugin in backticks` })),
  ];
};
