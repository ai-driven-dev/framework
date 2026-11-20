"use strict";
// docs/CATALOG.md, from plugins/*/agents/ and plugins/*/hooks/hooks.json: the agents and hooks block each plugin holds between its own markers.
// Written by `run.cjs --fix`, from the pre-commit hook.
const fs = require("node:fs");
const path = require("node:path");

const SCRIPT_REFERENCE = /\$\{CLAUDE_PLUGIN_ROOT\}\/([^\s"]+)/gu;

const table = (header, rows) => {
  const line = (cells) => `| ${cells.join(" | ")} |`;
  return [line(header), line(header.map(() => "---")), ...rows.map(line)].join("\n");
};

const agentRows = (plugin) => {
  const directory = path.join(plugin, "agents");
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).sort().filter((file) => file.endsWith(".md")).map((file) => {
    const description = fs.readFileSync(path.join(directory, file), "utf8").match(/^description:\s*(.+)$/mu)?.[1];
    if (!description) throw new Error(`${path.basename(plugin)}/agents/${file} has no description`);
    return [`\`${file.replace(/\.md$/u, "")}\``, description.split(". ")[0].replace(/\.$/u, "")];
  });
};

const hookRows = (plugin) => {
  const manifest = path.join(plugin, "hooks", "hooks.json");
  if (!fs.existsSync(manifest)) return [];
  return Object.entries(JSON.parse(fs.readFileSync(manifest, "utf8")).hooks ?? {}).map(([event, handlers]) => {
    const scripts = [...new Set([...JSON.stringify(handlers).matchAll(SCRIPT_REFERENCE)].map((match) => match[1]))];
    return [`\`${event}\``, scripts.map((script) => `\`${script}\``).join(" · ")];
  });
};

/** The block of one plugin: its agents then its hooks, empty when it ships neither. */
function extrasBlock(plugin) {
  const sections = [];
  const agents = agentRows(plugin);
  if (agents.length > 0) sections.push(`**Agents**\n\n${table(["Agent", "Role"], agents)}`);
  const hooks = hookRows(plugin);
  if (hooks.length > 0) sections.push(`**Hooks**\n\n${table(["Event", "Runs"], hooks)}`);
  return sections.join("\n\n");
}

module.exports = {
  name: "catalog-extras",
  watch: ["docs/CATALOG.md", "plugins/*/agents/*.md", "plugins/*/hooks/hooks.json"],
  run({ root, write }) {
    const plugins = path.join(root, "plugins");
    const catalog = path.join(root, "docs", "CATALOG.md");
    if (!fs.existsSync(plugins) || !fs.existsSync(catalog)) return [];
    const before = fs.readFileSync(catalog, "utf8");
    let text = before;
    const found = [];
    for (const name of fs.readdirSync(plugins, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
      const body = extrasBlock(path.join(plugins, name));
      const block = new RegExp(`(<!--extras-${name}:start-->)[\\s\\S]*?(<!--extras-${name}:end-->)`, "u");
      if (!block.test(text)) {
        if (body) found.push({ problem: `docs/CATALOG.md has no <!--extras-${name}:start--> and <!--extras-${name}:end--> markers for the agents or hooks of ${name}` });
      } else if (!body) found.push({ problem: `docs/CATALOG.md holds an extras block for ${name}, which ships no agent and no hook: delete the block` });
      else text = text.replace(block, (_, open, close) => `${open}\n\n${body}\n\n${close}`);
    }
    if (text !== before) {
      if (write) fs.writeFileSync(catalog, text);
      found.push("docs/CATALOG.md");
    }
    return found;
  },
};
