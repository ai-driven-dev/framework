#!/usr/bin/env node
// Renders the tables a person must not type by hand: the hooks each plugin declares
// (docs/CATALOG.md, from plugins/*/hooks/hooks.json), the agents beside them (from plugins/*/agents/) and what each tool is declared to
// support (docs/COMPATIBILITY.md and the tool list in README.md, from the CLI's stored
// tool-support record), the plugin grid in README.md
// (from the tree and docs/assets/plugins/plugins.json). Each block sits between its own
// markers. `--check` reports instead of writing; `--root <dir>` points the script at another
// tree, which is how its test runs it.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rootFlag = process.argv.indexOf("--root");
const ROOT =
  rootFlag === -1 ? fileURLToPath(new URL("..", import.meta.url)) : `${process.argv[rootFlag + 1]}/`;
const COMPATIBILITY = `${ROOT}docs/COMPATIBILITY.md`;
const CATALOG = `${ROOT}docs/CATALOG.md`;
const README = `${ROOT}README.md`;
const SUPPORT_RECORD = `${ROOT}cli/tests/golden/snapshots/tool-support/surface.json`;

const PLUGIN_CONFIG = `${ROOT}docs/assets/plugins/plugins.json`;

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
function agentsTable() {
  const rows = [];
  for (const plugin of readdirSync(`${ROOT}plugins`).sort()) {
    const directory = `${ROOT}plugins/${plugin}/agents`;
    if (!existsSync(directory)) continue;
    for (const file of readdirSync(directory).sort()) {
      if (!file.endsWith(".md")) continue;
      const description = readFileSync(`${directory}/${file}`, "utf8").match(/^description:\s*(.+)$/m)?.[1];
      if (!description) throw new Error(`${plugin}/agents/${file} has no description`);
      rows.push([`\`${file.replace(/\.md$/, "")}\``, `[\`${plugin}\`](../plugins/${plugin}/README.md)`, description.split(". ")[0].replace(/\.$/, "")]);
    }
  }
  return table(["Agent", "Plugin", "Role"], rows);
}

function supportTables() {
  const record = JSON.parse(readFileSync(SUPPORT_RECORD, "utf8"));
  const icon = (support) => (support === "no" ? "❌" : support === "bridge" ? "🔌" : "✅");

  const carried = SURFACES.filter(([key]) =>
    record.some((tool) => Object.values(tool.builds).some((build) => build[key] !== "no"))
  );

  const cell = (tool, key) => {
    const layouts = Object.entries(tool.builds);
    const values = new Set(layouts.map(([, build]) => build[key]));
    if (values.size === 1) return icon([...values][0]);
    return "🟡";
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

function skillNames(plugin) {
  const skills = `${ROOT}plugins/${plugin}/skills`;
  if (!existsSync(skills)) return [];
  return readdirSync(skills, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(`${skills}/${entry.name}/SKILL.md`))
    .map((entry) => entry.name)
    .sort()
    .map((name) => name.replace(/^\d+-/, ""));
}

/** The plugins in config order, refusing a plugin with no entry or an entry with no plugin. */
function plugins() {
  const config = JSON.parse(readFileSync(PLUGIN_CONFIG, "utf8"));
  const plugins = readdirSync(`${ROOT}plugins`, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const missing = plugins.filter((plugin) => !(plugin in config));
  const unknown = Object.keys(config).filter((plugin) => !plugins.includes(plugin));
  if (missing.length > 0 || unknown.length > 0) {
    throw new Error(`plugins.json and plugins/ disagree. No entry: ${missing}. No plugin: ${unknown}`);
  }
  return Object.keys(config).map((plugin) => ({ plugin, entry: config[plugin], skills: skillNames(plugin) }));
}

const STATUS = { stable: "🟢 stable", beta: "🧪 beta", alpha: "🚧 alpha", new: "🆕 new" };
const SHOWN_SKILLS = 4;

/** A grid of three columns: GitHub shows an HTML table the way the old README did. */
function pluginGrid() {
  const cell = ({ plugin, entry, skills }) => {
    const shown = skills.slice(0, SHOWN_SKILLS).map((name) => `<code>${name}</code>`).join(" · ");
    const more = skills.length > SHOWN_SKILLS ? ` · +${skills.length - SHOWN_SKILLS}` : "";
    const count = `${skills.length} ${skills.length === 1 ? "skill" : "skills"}`;
    return [
      '<td width="33%" valign="top">',
      `<h3>${entry.emoji} <a href="plugins/${plugin}/README.md">${plugin}</a></h3>`,
      `<b>${STATUS[entry.status]}</b> · ${count}<br />`,
      `${entry.description}<br /><br />`,
      `${shown}${more}`,
      "</td>",
    ].join("\n");
  };
  const all = plugins();
  const rows = [];
  for (let at = 0; at < all.length; at += 3) {
    const row = all.slice(at, at + 3).map(cell);
    while (row.length < 3) row.push('<td width="33%"></td>');
    rows.push(`<tr>\n${row.join("\n")}\n</tr>`);
  }
  return `<table>\n${rows.join("\n")}\n</table>`;
}

const targets = [
  [README, "tools", toolsTable],
  [README, "plugins", pluginGrid],
  [CATALOG, "hooks", hooksTable],
  [CATALOG, "agents", agentsTable],
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
