#!/usr/bin/env node
// Renders the tables that read the CLI's stored tool-support record, so they stay outside
// scripts/check/run.cjs (the framework runs without the CLI): docs/COMPATIBILITY.md and the
// tool list in README.md. Each block sits between its own markers. Everything else generated
// (catalogs, README grid and counts, docs/CATALOG.md) is `node scripts/check/run.cjs --fix`.
// `--check` reports instead of writing; `--root <dir>` points the script at another tree,
// which is how its test runs it.

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const { publishableTools } = createRequire(import.meta.url)("./marketplace-tools.cjs");

const rootFlag = process.argv.indexOf("--root");
const ROOT =
  rootFlag === -1 ? fileURLToPath(new URL("..", import.meta.url)) : `${process.argv[rootFlag + 1]}/`;
const COMPATIBILITY = `${ROOT}docs/COMPATIBILITY.md`;
const README = `${ROOT}README.md`;
const SUPPORT_RECORD = `${ROOT}cli/tests/golden/snapshots/tool-support/surface.json`;

const SURFACES = [
  ["skills", "Skills"],
  ["agents", "Agents"],
  ["mcp", "MCP"],
  ["hooks", "Hooks"],
  ["rules", "Rules"],
  ["commands", "Commands"],
];

function between(name) {
  return new RegExp(`(<!--${name}:start-->)[\\s\\S]*?(<!--${name}:end-->)`);
}

function replaceBlock(text, name, body) {
  const pattern = between(name);
  if (!pattern.test(text)) throw new Error(`markers <!--${name}:start--> and <!--${name}:end--> not found`);
  return text.replace(pattern, `$1\n\n${body}\n\n$2`);
}

function table(header, rows) {
  const line = (cells) => `| ${cells.join(" | ")} |`;
  return [line(header), line(header.map(() => "---")), ...rows.map(line)].join("\n");
}

/** A tool that loads the plugin tree `aidd` writes into a project directory has a native plugin
 * install, and no marketplace to register: `withPath` names the directory, `mark` says the rest. */
function marketplaceCell(tool, { mark, withPath }) {
  if (tool.pluginTree === null) return mark(tool.builds.marketplace);
  return withPath ? `Plugin directory \`${tool.pluginTree}\`` : "Plugin directory";
}

/** One row per tool: how it installs, then what each surface becomes. A surface no tool carries gets no column. */
function supportTables() {
  const record = JSON.parse(readFileSync(SUPPORT_RECORD, "utf8"));
  const icon = (support) => (support === "no" ? "❌" : support === "bridge" ? "Some events" : "✅");
  const methodLabel = { marketplace: "Marketplace", flat: "Flat files" };

  const carried = SURFACES.filter(([key]) =>
    record.some((tool) => Object.values(tool.builds).some((build) => build[key] !== "no"))
  );

  const cell = (tool, key) => {
    const layouts = Object.entries(tool.builds);
    const values = new Set(layouts.map(([, build]) => build[key]));
    if (values.size === 1) return icon([...values][0]);
    const carriers = layouts.filter(([, build]) => build[key] !== "no").map(([method]) => methodLabel[method]);
    return `${carriers.join(" and ")} only`;
  };

  const hosted = new Set(publishableTools(record).map((tool) => tool.id));

  return table(
    ["Tool", "Directory", "Marketplace", "Hosted catalog", "Flat files", ...carried.map(([, label]) => label)],
    record.map((tool) => [
      tool.name,
      `\`${tool.directory}\``,
      marketplaceCell(tool, { mark: (present) => (present ? "✅" : "❌"), withPath: true }),
      hosted.has(tool.id) ? "✅" : "❌",
      tool.builds.flat ? "✅" : "❌",
      ...carried.map(([key]) => cell(tool, key)),
    ])
  );
}

/**
 * GitHub sizes every table to its content and ignores a width on the table itself. A width on
 * the header cells is honored: cells that ask for more than the page offers fill it, and squeeze
 * back on a narrow screen. The numbers are proportions, not pixels.
 */
function wideTable(header, rows, widths) {
  const cell = (tag, width) => (text, index) =>
    `<${tag}${width ? ` width="${width[index]}"` : ""}${index > 0 ? ' align="center"' : ""}>${text}</${tag}>`;
  const line = (cells, tag, width) => `<tr>${cells.map(cell(tag, width)).join("")}</tr>`;
  return [
    "<table>",
    `<thead>${line(header, "th", widths)}</thead>`,
    `<tbody>${rows.map((cells) => line(cells, "td")).join("\n")}</tbody>`,
    "</table>",
  ].join("\n");
}

function toolsTable() {
  const record = JSON.parse(readFileSync(SUPPORT_RECORD, "utf8"));
  const mark = (present) => (present ? "✅" : "—");
  return wideTable(
    ["Tool", "CLI", "Plugin marketplace", "Flat files"],
    record.map((tool) => [
      `<b>${tool.name}</b>`,
      "✅",
      marketplaceCell(tool, { mark, withPath: false }),
      mark(tool.builds.flat),
    ]),
    [800, 400, 400, 400]
  );
}

const targets = [
  [README, "tools", toolsTable],
  [COMPATIBILITY, "support", supportTables],
];

const check = process.argv.includes("--check");
let drifted = false;
for (const [file, name, render] of targets) {
  const before = readFileSync(file, "utf8");
  const after = replaceBlock(before, name, render());
  if (after === before) continue;
  drifted = true;
  if (!check) {
    writeFileSync(file, after);
    console.log(`synced ${file.replace(ROOT, "")} (${name})`);
  }
}

if (drifted && check) {
  console.error("A generated table is stale. Run: node scripts/sync-generated-docs.mjs");
  process.exit(1);
}
