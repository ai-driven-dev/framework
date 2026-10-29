#!/usr/bin/env node
// Renders the tables a person must not type by hand: the hooks each plugin declares
// (docs/ARCHITECTURE.md, from plugins/*/hooks/hooks.json) and what each tool is declared to
// support (docs/COMPATIBILITY.md and the tool list in README.md, from the CLI's stored
// tool-support record), the plugin cards in README.md with the SVG files they show
// (docs/assets/plugins/, from the tree and plugins.json). Each block sits between its own
// markers. `--check` reports instead of writing; `--root <dir>` points the script at another
// tree, which is how its test runs it.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cardSvg, cardsMarkup } from "./lib/plugin-cards.mjs";

const rootFlag = process.argv.indexOf("--root");
const ROOT =
  rootFlag === -1 ? fileURLToPath(new URL("..", import.meta.url)) : `${process.argv[rootFlag + 1]}/`;
const ARCHITECTURE = `${ROOT}docs/ARCHITECTURE.md`;
const COMPATIBILITY = `${ROOT}docs/COMPATIBILITY.md`;
const README = `${ROOT}README.md`;
const SUPPORT_RECORD = `${ROOT}cli/tests/golden/snapshots/tool-support/surface.json`;

const CARD_DIRECTORY = `${ROOT}docs/assets/plugins`;
const CARD_CONFIG = `${CARD_DIRECTORY}/plugins.json`;

const SCRIPT_REFERENCE = /\$\{CLAUDE_PLUGIN_ROOT\}\/([^\s"]+)/g;
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

function hooksTable() {
  const rows = [];
  for (const plugin of readdirSync(`${ROOT}plugins`).sort()) {
    const manifest = `${ROOT}plugins/${plugin}/hooks/hooks.json`;
    if (!existsSync(manifest)) continue;
    const raw = readFileSync(manifest, "utf8");
    const events = Object.keys(JSON.parse(raw).hooks ?? {});
    const scripts = [...new Set([...raw.matchAll(SCRIPT_REFERENCE)].map((match) => match[1]))];
    rows.push([
      `[\`${plugin}\`](../plugins/${plugin}/README.md)`,
      events.map((event) => `\`${event}\``).join(" · "),
      scripts.map((script) => `\`${script}\``).join(" · "),
    ]);
  }
  return table(["Plugin", "Event", "Runs"], rows);
}

/** One row per tool: how it installs, then what each surface becomes. A surface no tool carries gets no column. */
function supportTables() {
  const record = JSON.parse(readFileSync(SUPPORT_RECORD, "utf8"));
  const icon = (support) => (support === "no" ? "❌" : support === "bridge" ? "✅ bridge" : "✅");
  const layoutName = { marketplace: "marketplace", flat: "flat files" };

  const carried = SURFACES.filter(([key]) =>
    record.some((tool) => Object.values(tool.builds).some((build) => build[key] !== "no"))
  );

  const cell = (tool, key) => {
    const layouts = Object.entries(tool.builds);
    const values = new Set(layouts.map(([, build]) => build[key]));
    if (values.size === 1) return icon([...values][0]);
    return layouts.map(([layout, build]) => `${icon(build[key])} ${layoutName[layout]}`).join(", ");
  };

  return table(
    ["Tool", "Directory", "Marketplace", "Flat files", ...carried.map(([, label]) => label)],
    record.map((tool) => [
      tool.name,
      `\`${tool.directory}\``,
      tool.builds.marketplace ? "✅" : "❌",
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
    record.map((tool) => [`<b>${tool.name}</b>`, "✅", mark(tool.builds.marketplace), mark(tool.builds.flat)]),
    [800, 400, 400, 400]
  );
}

function skillCount(plugin) {
  const skills = `${ROOT}plugins/${plugin}/skills`;
  if (!existsSync(skills)) return 0;
  return readdirSync(skills, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory() && existsSync(`${skills}/${entry.name}/SKILL.md`)
  ).length;
}

/** The cards in config order, refusing a plugin with no entry or an entry with no plugin. */
function cards() {
  const config = JSON.parse(readFileSync(CARD_CONFIG, "utf8"));
  const plugins = readdirSync(`${ROOT}plugins`, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const missing = plugins.filter((plugin) => !(plugin in config));
  const unknown = Object.keys(config).filter((plugin) => !plugins.includes(plugin));
  if (missing.length > 0 || unknown.length > 0) {
    throw new Error(`plugins.json and plugins/ disagree. No entry: ${missing}. No plugin: ${unknown}`);
  }
  return Object.keys(config).map((plugin) => ({ plugin, entry: config[plugin], skills: skillCount(plugin) }));
}

function cardFiles() {
  return cards().flatMap(({ plugin, entry, skills }) =>
    ["light", "dark"].map((theme) => [`${CARD_DIRECTORY}/${plugin}-${theme}.svg`, cardSvg(plugin, entry, skills, theme)])
  );
}

const targets = [
  [README, "tools", toolsTable],
  [README, "plugins", () => cardsMarkup(cards())],
  [ARCHITECTURE, "hooks", hooksTable],
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

mkdirSync(CARD_DIRECTORY, { recursive: true });
for (const [file, svg] of cardFiles()) {
  if (existsSync(file) && readFileSync(file, "utf8") === svg) continue;
  drifted = true;
  if (!check) {
    writeFileSync(file, svg);
    console.log(`synced ${file.replace(ROOT, "")}`);
  }
}

if (drifted && check) {
  console.error("A generated table is stale. Run: node scripts/sync-generated-docs.mjs");
  process.exit(1);
}
